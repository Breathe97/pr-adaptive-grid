import ReactDOM from 'react-dom/client'
import App from './App'
import { StrictMode } from 'react'
import './style.css'

// 不用 StrictMode：避免开发环境双重挂载导致入场动画播放两次
ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
