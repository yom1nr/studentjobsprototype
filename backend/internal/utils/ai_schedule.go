package utils

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type TimeSlot struct {
	Day       string `json:"day"`        // "Monday", "Tuesday", etc.
	StartTime string `json:"start_time"` // "09:00"
	EndTime   string `json:"end_time"`   // "12:00"
}

type ExtractedScheduleResponse struct {
	ClassSlots []TimeSlot `json:"class_slots"`
	FreeSlots  []TimeSlot `json:"free_slots"`
}

type geminiRestRequest struct {
	Contents []geminiContent `json:"contents"`
}

type geminiContent struct {
	Parts []geminiPart `json:"parts"`
}

type geminiPart struct {
	Text       string           `json:"text,omitempty"`
	InlineData *geminiInlineData `json:"inline_data,omitempty"`
}

type geminiInlineData struct {
	MimeType string `json:"mime_type"`
	Data     string `json:"data"`
}

type geminiRestResponse struct {
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

// ExtractScheduleFromImage parses a class schedule image using Gemini Vision API
func ExtractScheduleFromImage(ctx context.Context, imgBytes []byte, mimeType string) (*ExtractedScheduleResponse, error) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if envs, err := godotenv.Read(); err == nil && envs["GEMINI_API_KEY"] != "" {
		apiKey = envs["GEMINI_API_KEY"]
	}
	apiKey = strings.TrimSpace(apiKey)
	apiKey = strings.Trim(apiKey, "\"'")

	if apiKey == "" {
		return nil, fmt.Errorf("GEMINI_API_KEY is not set in backend/.env")
	}

	format := strings.ToLower(mimeType)
	if strings.Contains(format, "jpeg") || strings.Contains(format, "jpg") {
		format = "image/jpeg"
	} else if strings.Contains(format, "png") {
		format = "image/png"
	} else if strings.Contains(format, "webp") {
		format = "image/webp"
	} else {
		format = "image/jpeg"
	}

	promptText := `Analyze the provided class schedule image (ตารางเรียน) and extract all scheduled class time slots.
Respond strictly in JSON format matching this schema:
{
  "class_slots": [
    {"day": "Monday", "start_time": "09:00", "end_time": "12:00"},
    {"day": "Wednesday", "start_time": "13:30", "end_time": "16:30"}
  ]
}
Day must be one of: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday.
Start_time and end_time must be in 24-hour HH:MM format.
If no classes are found or image cannot be read, return {"class_slots": []}.`

	base64Img := base64.StdEncoding.EncodeToString(imgBytes)

	reqPayload := geminiRestRequest{
		Contents: []geminiContent{
			{
				Parts: []geminiPart{
					{Text: promptText},
					{
						InlineData: &geminiInlineData{
							MimeType: format,
							Data:     base64Img,
						},
					},
				},
			},
		},
	}

	jsonBytes, err := json.Marshal(reqPayload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request payload: %w", err)
	}

	modelsToTry := []string{"gemini-3.6-flash", "gemini-2.5-flash", "gemini-1.5-flash"}
	httpClient := &http.Client{Timeout: 30 * time.Second}

	var lastErr error
	var rawText string

	for _, modelName := range modelsToTry {
		url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", modelName, apiKey)
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(jsonBytes))
		if err != nil {
			lastErr = err
			continue
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := httpClient.Do(req)
		if err != nil {
			lastErr = err
			continue
		}

		respBytes, readErr := io.ReadAll(resp.Body)
		resp.Body.Close()

		if readErr != nil {
			lastErr = readErr
			continue
		}

		var apiResp geminiRestResponse
		if err := json.Unmarshal(respBytes, &apiResp); err != nil {
			lastErr = err
			continue
		}

		if apiResp.Error != nil {
			lastErr = fmt.Errorf("Google API Error (%d %s): %s", apiResp.Error.Code, apiResp.Error.Status, apiResp.Error.Message)
			continue
		}

		if len(apiResp.Candidates) > 0 && len(apiResp.Candidates[0].Content.Parts) > 0 {
			rawText = apiResp.Candidates[0].Content.Parts[0].Text
			lastErr = nil
			break
		}
	}

	if lastErr != nil {
		return nil, fmt.Errorf("Gemini Vision API call failed: %w", lastErr)
	}

	if rawText == "" {
		return nil, fmt.Errorf("no response text received from Gemini AI")
	}

	cleanJSON := strings.TrimSpace(rawText)
	cleanJSON = strings.TrimPrefix(cleanJSON, "```json")
	cleanJSON = strings.TrimPrefix(cleanJSON, "```")
	cleanJSON = strings.TrimSuffix(cleanJSON, "```")
	cleanJSON = strings.TrimSpace(cleanJSON)

	var result ExtractedScheduleResponse
	if err := json.Unmarshal([]byte(cleanJSON), &result); err != nil {
		return nil, fmt.Errorf("failed to parse AI response JSON: %w (raw response: %s)", err, rawText)
	}

	result.FreeSlots = CalculateFreeSlots(result.ClassSlots)
	return &result, nil
}

// CalculateFreeSlots computes available free time intervals from 08:00 to 20:00 for each day,
// subtracting all extracted class slots.
func CalculateFreeSlots(classSlots []TimeSlot) []TimeSlot {
	days := []string{"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}
	var freeSlots []TimeSlot

	parseTimeMinutes := func(tStr string) int {
		var h, m int
		fmt.Sscanf(tStr, "%d:%d", &h, &m)
		return h*60 + m
	}

	formatTimeMinutes := func(mins int) string {
		h := mins / 60
		m := mins % 60
		return fmt.Sprintf("%02d:%02d", h, m)
	}

	for _, day := range days {
		type interval struct{ start, end int }
		var dayClasses []interval

		for _, slot := range classSlots {
			if strings.EqualFold(slot.Day, day) {
				s := parseTimeMinutes(slot.StartTime)
				e := parseTimeMinutes(slot.EndTime)
				if s < e {
					dayClasses = append(dayClasses, interval{start: s, end: e})
				}
			}
		}

		sort.Slice(dayClasses, func(i, j int) bool {
			return dayClasses[i].start < dayClasses[j].start
		})

		// Working window: 08:00 (480 mins) to 20:00 (1200 mins)
		curr := 480
		dayEnd := 1200

		for _, cls := range dayClasses {
			if cls.start > curr {
				end := cls.start
				if end > dayEnd {
					end = dayEnd
				}
				if end > curr {
					freeSlots = append(freeSlots, TimeSlot{
						Day:       day,
						StartTime: formatTimeMinutes(curr),
						EndTime:   formatTimeMinutes(end),
					})
				}
			}
			if cls.end > curr {
				curr = cls.end
			}
		}

		if curr < dayEnd {
			freeSlots = append(freeSlots, TimeSlot{
				Day:       day,
				StartTime: formatTimeMinutes(curr),
				EndTime:   formatTimeMinutes(dayEnd),
			})
		}
	}

	return freeSlots
}
