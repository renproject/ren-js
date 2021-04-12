import React from 'react'

const DefaultComponent: React.FC = ({ children }) => {
  return (
    <div
      style={{
        padding: '10px',
        height: '100vw',
        position: 'relative',
        backgroundColor: 'aliceblue'
      }}
    >
      <h1 style={{ color: 'greener' }}>Ren React</h1>
      <h3 style={{ color: 'orangered' }}>Cool</h3>
      {children}
    </div>
  )
}

export default DefaultComponent
