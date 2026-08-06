import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Link,
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import type { User } from '../interface/IUserInterface'

export function UsersTable({ users }: Readonly<{ users: User[] }>) {
  if (users.length === 0) {
    return <Typography color="text.secondary">No users</Typography>
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell width={80}>ID</TableCell>
            <TableCell>Username</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>Phone</TableCell>
            <TableCell width={100}>Role</TableCell>
            <TableCell width={160}>Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id} hover>
              <TableCell>{u.id}</TableCell>
              <TableCell>{u.user_name}</TableCell>
              <TableCell>{u.email}</TableCell>
              <TableCell>{u.phone}</TableCell>
              <TableCell>{u.role}</TableCell>
              <TableCell>
                <Link component={RouterLink} to={`/users/${u.id}`}>
                  View
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
