import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  AppBar, Box, Drawer, IconButton, List, ListItemButton, ListItemIcon,
  ListItemText, Toolbar, Typography, Divider, useMediaQuery, Avatar, Tooltip, Badge,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import MenuIcon from '@mui/icons-material/Menu'
import DashboardIcon from '@mui/icons-material/SpaceDashboard'
import VideocamIcon from '@mui/icons-material/Videocam'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import SubtitlesIcon from '@mui/icons-material/Subtitles'
import AssignmentIcon from '@mui/icons-material/AssignmentTurnedIn'
import ArchiveIcon from '@mui/icons-material/Inventory2'
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone'
import Logo from './Logo'
import { useMeeting } from '../store/MeetingContext'

const DRAWER_WIDTH = 264

const navItems = [
  { to: '/', label: 'Дашборд', icon: <DashboardIcon /> },
  { to: '/connect', label: 'Подключение бота', icon: <VideocamIcon /> },
  { to: '/recording', label: 'Запись совещания', icon: <FiberManualRecordIcon /> },
  { to: '/transcript', label: 'Транскрипт', icon: <SubtitlesIcon /> },
  { to: '/assignments', label: 'Поручения', icon: <AssignmentIcon /> },
  { to: '/archive', label: 'Архив совещаний', icon: <ArchiveIcon /> },
]

export default function Layout() {
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { meeting } = useMeeting()

  const draftCount = meeting.assignments.filter((a) => a.status === 'draft').length

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
        <Avatar sx={{ bgcolor: 'secondary.main', width: 36, height: 36 }}>СА</Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 13.5, fontWeight: 600 }} noWrap>
            Соколов А.П.
          </Typography>
          <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }} noWrap>
            Начальник дистанции
          </Typography>
        </Box>
      </Box>
    </Box>
  )

  const currentTitle = navItems.find((n) => n.to === location.pathname)?.label ?? 'РЖД · Протокол'

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
          <Tooltip title="Уведомления">
            <IconButton>
              <Badge badgeContent={draftCount} color="primary">
                <NotificationsNoneIcon />
              </Badge>
            </IconButton>
          </Tooltip>
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
        <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1280, mx: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
