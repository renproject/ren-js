// THIS IS THE ENTRY POINT FOR THE LIBRARY DEMO / TEST (IT IS NOT EXPORTED ON BUILD)
import React from 'react'
import ReactDOM from 'react-dom'
import App from './demo/App'
ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
)
// Hot Module Replacement (HMR) - Remove this snippet to remove HMR.
// Learn more: https://www.snowpack.dev/concepts/hot-module-replacement
if ((import.meta as any).hot) {
  ;(import.meta as any).hot.accept()
}
