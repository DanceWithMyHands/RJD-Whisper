import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  AppBar, Box, Drawer, IconButton, List, ListItemButton, ListItemIcon,
  ListItemText, Toolbar, Typography, Divider, useMediaQuery, Avatar, Tooltip,
  Badge, Menu, MenuItem,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import MenuIcon from '@mui/icons-material/Menu'
import DashboardIcon from '@mui/icons-material/SpaceDashboard'
import VideocamIcon from '@mui/icons-material/Videocam'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import SubtitlesIcon from '@mui/icons-material/Subtitles'
import AssignmentIcon from '@mui/icons-material/AssignmentTurnedIn'
import ArchiveIcon from '@mui/icons-material/Inventory2'
import PeopleIcon from '@mui/icons-material/People'
import LogoutIcon from '@mui/icons-material/Logout'
import Logo from './Logo'
import { useAuth } from '../auth/AuthContext'
import { useActiveMeeting } from '../store/ActiveMeetingContext'
import { useAssignments } from '../hooks/queries'
import { isManagerial, roleLabels } from '../api/types'
import { initials } from '../utils/format'

const DRAWER_WIDTH = 264

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  managerialOnly?: boolean
  adminOnly?: boolean
}

const ALL_NAV: NavItem[] = [
  { to: '/', label: 'Дашборд', icon: <DashboardIcon /> },
  { to: '/connect', label: 'Новое совещание', icon: <VideocamIcon />, managerialOnly: true },
  { to: '/upload', label: 'Загрузка аудио', icon: <UploadFileIcon />, managerialOnly: true },
  { to: '/recording', label: 'Запись', icon: <FiberManualRecordIcon />, managerialOnly: true },
  { to: '/transcript', label: 'Транскрипт', icon: <SubtitlesIcon /> },
  { to: '/assignments', label: 'Поручения', icon: <AssignmentIcon /> },
  { to: '/archive', label: 'Архив совещаний', icon: <ArchiveIcon /> },
  { to: '/users', label: 'Пользователи', icon: <PeopleIcon />, adminOnly: true },
]

export default function Layout() {
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { activeMeetingId } = useActiveMeeting()
  const { data: assignments } = useAssignments(activeMeetingId)

  const draftCount = (assignments ?? []).filter((a) => a.status === 'draft').length

  const navItems = ALL_NAV.filter((n) => {
    if (n.adminOnly) return user?.role === 'admin'
    if (n.managerialOnly) return isManagerial(user?.role)
    return true
  })

  const handleLogout = () => {
    setMenuAnchor(null)
    logout()
    navigate('/login', { replace: true })
  }

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ px: 2 }}>
        <Logo />
      </Toolbar>
      <Divider />
      <List sx={{ px: 1.5, py: 1, flex: 1 }}>
        {navItems.map((item) => {
          const selected = location.pathname === item.to
          const showBadge = item.to === '/assignments' && draftCount > 0
          return (
            <ListItemButton
              key={item.to}
              selected={selected}
              onClick={() => {
                navigate(item.to)
                if (!isDesktop) setMobileOpen(false)
              }}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': { bgcolor: 'primary.dark' },
                  '& .MuiListItemIcon-root': { color: 'primary.contrastText' },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: selected ? 'inherit' : 'text.secondary' }}>
                {showBadge ? (
                  <Badge badgeContent={draftCount} color="primary" overlap="circular">
                    {item.icon}
                  </Badge>
                ) : (
                  item.icon
                )}
              </ListItemIcon>
              <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14.5, fontWeight: selected ? 600 : 500 }} />
            </ListItemButton>
          )
        })}
      </List>
      <Divider />
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ bgcolor: 'secondary.main', width: 36, height: 36, fontSize: 13 }}>
          {user ? initials(user.full_name) : '—'}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: 13.5, fontWeight: 600 }} noWrap>
            {user?.full_name ?? '—'}
          </Typography>
          <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }} noWrap>
            {user?.position || (user ? roleLabels[user.role] : '')}
          </Typography>
        </Box>
        <Tooltip title="Выйти">
          <IconButton size="small" onClick={handleLogout}>
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  )

  const currentTitle = ALL_NAV.find((n) => n.to === location.pathname)?.label ?? 'РЖД · Протокол'

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        color="inherit"
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
          borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper',
        }}
      >
        <Toolbar>
          <IconButton edge="start" onClick={() => setMobileOpen(true)} sx={{ mr: 2, display: { md: 'none' } }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {currentTitle}
          </Typography>
          <Tooltip title="Профиль">
            <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)}>
              <Avatar sx={{ bgcolor: 'secondary.main', width: 34, height: 34, fontSize: 13 }}>
                {user ? initials(user.full_name) : '—'}
              </Avatar>
            </IconButton>
          </Tooltip>
          <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
            <MenuItem disabled sx={{ opacity: '1 !important' }}>
              <Box>
                <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{user?.full_name}</Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{user?.email}</Typography>
              </Box>
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
              Выйти
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, borderRight: '1px solid', borderColor: 'divider' } }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        <Toolbar />
        <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1280, mx: "auto" }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
