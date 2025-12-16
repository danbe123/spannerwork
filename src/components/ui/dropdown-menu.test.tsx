import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from './dropdown-menu'

describe('dropdown-menu', () => {
  it('renders all exported components and opens menu content', async () => {
    const user = userEvent.setup()

    if (!('ResizeObserver' in globalThis)) {
      ;(globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    }

    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent>
            <DropdownMenuLabel inset>Label</DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem inset>Item</DropdownMenuItem>
              <DropdownMenuCheckboxItem checked>Checked</DropdownMenuCheckboxItem>
              <DropdownMenuRadioGroup value="a" onValueChange={() => {}}>
                <DropdownMenuRadioItem value="a">Radio A</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuSub defaultOpen>
                <DropdownMenuSubTrigger inset>More</DropdownMenuSubTrigger>
                <DropdownMenuSubContent forceMount>
                  <DropdownMenuItem>Sub Item</DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>
            <DropdownMenuShortcut>⌘K</DropdownMenuShortcut>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenu>
    )

    await user.click(screen.getByText('Open'))

    expect(await screen.findByText('Item')).toBeInTheDocument()
    expect(screen.getByText('Checked')).toBeInTheDocument()
    expect(screen.getByText('Radio A')).toBeInTheDocument()
    expect(screen.getByText('Label')).toBeInTheDocument()
    expect(screen.getByText('Sub Item')).toBeInTheDocument()
    expect(screen.getByText('⌘K')).toBeInTheDocument()

    expect(screen.getByText('Item').className).toContain('pl-8')
    expect(screen.getByText('Label').className).toContain('pl-8')
    expect(screen.getByText('More').className).toContain('pl-8')
  })
})
