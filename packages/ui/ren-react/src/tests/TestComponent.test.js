import React from 'react'
import { render } from '@testing-library/react'

import About from '../library/Sample/DefaultComponent'

let props

describe('Test Component', () => {
  beforeEach(() => {
    props = {
      theme: 'primary'
    }
  })

  const renderComponent = () => render(<About {...props} />)

  it('should have primary className with default props', () => {
    const { getByTestId } = renderComponent()
    const About = getByTestId('test-component')
    expect(About).toHaveClass('test-component-primary')
    console.log(About)
  })

  it('should have secondary className with theme set as secondary', () => {
    const { getByTestId } = renderComponent()
    const About = getByTestId('test-component')
    expect(About).toHaveClass(`test-component-secondary`)
  })
})
