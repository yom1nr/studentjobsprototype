package utils

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"
)

// ErrAINotConfigured is returned when GEMINI_API_KEY is not set. Callers should
// translate this into a "service unavailable, enter it manually" response — the
// AI scan is a convenience on top of manual free-time entry, never a hard
// dependency.
var ErrAINotConfigured = errors.New("AI schedule extraction is not configured")

// ErrAIBusy is returned when Gemini is rate-limiting or temporarily overloaded
// (HTTP 429 / 503). Callers should tell the user to retry or enter free time
// manually — it is not a bug on our side.
var ErrAIBusy = errors.New("AI schedule extraction is temporarily unavailable")

// defaultGeminiModel is the vision model we call. Google retires model names
// fairly often, so GEMINI_MODEL can override it without a rebuild. No silent
// multi-model fallbacks — one model per request.
const defaultGeminiModel = "gemini-3.6-flash"

func geminiModelName() string {
	if m := strings.TrimSpace(os.Getenv("GEMINI_MODEL")); m != "" {
		return m
	}
	return defaultGeminiModel
}

// TimeSlot is one day + time range.
type TimeSlot struct {
	Day       string `json:"day"`        // Monday..Sunday
	StartTime string `json:"start_time"` // "09:00"
	EndTime   string `json:"end_time"`   // "12:00"
}

// ExtractedSchedule is what the endpoint returns: the class slots the AI read,
// the free slots we computed from them, and a ready-to-use Thai summary that the
// UI can drop straight into the student's "available_time" field.
type ExtractedSchedule struct {
	ClassSlots []TimeSlot `json:"class_slots"`
	FreeSlots  []TimeSlot `json:"free_slots"`
	Summary    string     `json:"summary"`
}

type geminiReq struct {
	Contents []geminiContent `json:"contents"`
}
type geminiContent struct {
	Parts []geminiPart `json:"parts"`
}
type geminiPart struct {
	Text       string        `json:"text,omitempty"`
	InlineData *geminiInline `json:"inline_data,omitempty"`
}
type geminiInline struct {
	MimeType string `json:"mime_type"`
	Data     string `json:"data"`
}
type geminiResp struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
	Error *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Status  string `json:"status"`
	} `json:"error"`
}

const schedulePrompt = `Read this class-schedule image (ตารางเรียน) and extract every scheduled class time slot.
Reply with ONLY JSON in this exact shape:
{"class_slots":[{"day":"Monday","start_time":"09:00","end_time":"12:00"}]}
day is one of Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday.
times are 24-hour HH:MM. If nothing is readable, reply {"class_slots":[]}.`

// ExtractScheduleFromImage sends the image to Gemini, gets the class slots, and
// derives the free slots (08:00–20:00 window). Returns ErrAINotConfigured when
// no API key is set.
func ExtractScheduleFromImage(ctx context.Context, img []byte, mimeType string) (*ExtractedSchedule, error) {
	apiKey := strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
	if apiKey == "" {
		return nil, ErrAINotConfigured
	}

	mt := "image/jpeg"
	switch {
	case strings.Contains(mimeType, "png"):
		mt = "image/png"
	case strings.Contains(mimeType, "webp"):
		mt = "image/webp"
	}

	body, err := json.Marshal(geminiReq{Contents: []geminiContent{{Parts: []geminiPart{
		{Text: schedulePrompt},
		{InlineData: &geminiInline{MimeType: mt, Data: base64.StdEncoding.EncodeToString(img)}},
	}}}})
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent", geminiModelName())
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-goog-api-key", apiKey)

	resp, err := (&http.Client{Timeout: 30 * time.Second}).Do(req)
	if err != nil {
		// A client timeout / deadline is Gemini being slow, not our bug —
		// surface it as "busy, try again" like an explicit 503.
		var ne net.Error
		if errors.Is(err, context.DeadlineExceeded) || (errors.As(err, &ne) && ne.Timeout()) {
			return nil, ErrAIBusy
		}
		return nil, fmt.Errorf("gemini request failed: %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))

	if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode == http.StatusServiceUnavailable {
		return nil, ErrAIBusy
	}

	var parsed geminiResp
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("gemini response not JSON: %w", err)
	}
	if parsed.Error != nil {
		if parsed.Error.Code == http.StatusTooManyRequests || parsed.Error.Code == http.StatusServiceUnavailable {
			return nil, ErrAIBusy
		}
		return nil, fmt.Errorf("gemini error %d %s: %s", parsed.Error.Code, parsed.Error.Status, parsed.Error.Message)
	}
	if len(parsed.Candidates) == 0 || len(parsed.Candidates[0].Content.Parts) == 0 {
		return nil, errors.New("gemini returned no content")
	}

	text := parsed.Candidates[0].Content.Parts[0].Text
	text = strings.TrimSpace(text)
	text = strings.TrimPrefix(text, "```json")
	text = strings.TrimPrefix(text, "```")
	text = strings.TrimSuffix(text, "```")
	text = strings.TrimSpace(text)

	var out struct {
		ClassSlots []TimeSlot `json:"class_slots"`
	}
	if err := json.Unmarshal([]byte(text), &out); err != nil {
		return nil, fmt.Errorf("could not parse AI schedule JSON: %w", err)
	}

	free := calculateFreeSlots(out.ClassSlots)
	return &ExtractedSchedule{
		ClassSlots: out.ClassSlots,
		FreeSlots:  free,
		Summary:    summariseFreeSlots(free),
	}, nil
}

// calculateFreeSlots subtracts class slots from an 08:00–20:00 window per day.
func calculateFreeSlots(classes []TimeSlot) []TimeSlot {
	days := []string{"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}
	toMin := func(s string) int {
		var h, m int
		_, _ = fmt.Sscanf(s, "%d:%d", &h, &m)
		return h*60 + m
	}
	fromMin := func(v int) string { return fmt.Sprintf("%02d:%02d", v/60, v%60) }

	var free []TimeSlot
	const dayStart, dayEnd = 480, 1200
	for _, day := range days {
		type iv struct{ s, e int }
		var busy []iv
		for _, c := range classes {
			if strings.EqualFold(c.Day, day) {
				s, e := toMin(c.StartTime), toMin(c.EndTime)
				if s < e {
					busy = append(busy, iv{s, e})
				}
			}
		}
		sort.Slice(busy, func(i, j int) bool { return busy[i].s < busy[j].s })

		cur := dayStart
		for _, b := range busy {
			if b.s > cur {
				end := b.s
				if end > dayEnd {
					end = dayEnd
				}
				if end > cur {
					free = append(free, TimeSlot{Day: day, StartTime: fromMin(cur), EndTime: fromMin(end)})
				}
			}
			if b.e > cur {
				cur = b.e
			}
		}
		if cur < dayEnd {
			free = append(free, TimeSlot{Day: day, StartTime: fromMin(cur), EndTime: fromMin(dayEnd)})
		}
	}
	return free
}

var dayTH = map[string]string{
	"Monday": "จ", "Tuesday": "อ", "Wednesday": "พ", "Thursday": "พฤ",
	"Friday": "ศ", "Saturday": "ส", "Sunday": "อา",
}

// summariseFreeSlots turns the free slots into one line for the available_time field.
func summariseFreeSlots(free []TimeSlot) string {
	if len(free) == 0 {
		return ""
	}
	parts := make([]string, 0, len(free))
	for _, s := range free {
		d := dayTH[s.Day]
		if d == "" {
			d = s.Day
		}
		parts = append(parts, fmt.Sprintf("%s %s-%s", d, s.StartTime, s.EndTime))
	}
	return strings.Join(parts, ", ")
}
