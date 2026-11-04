/** Formato único de menús desplegables: panel neutro, ítem activo en gris. */

export const menuPanelClass =
  "z-50 overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"

export const menuPanelAnimClass =
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"

export const menuItemClass =
  "relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-hidden select-none"

export const menuItemActiveClass = "bg-muted text-foreground"

export const menuItemIdleClass = "text-foreground hover:bg-muted hover:text-foreground"

export const menuItemDisabledClass =
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50"

/** Radix Select / DropdownMenu / ContextMenu: foco y teclado. */
export const menuItemFocusClass =
  "focus:bg-muted focus:text-foreground data-[highlighted]:bg-muted data-[highlighted]:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground"

/** cmdk Command: opción marcada por teclado o mouse. */
export const menuItemSelectedClass =
  "data-[selected=true]:bg-muted data-[selected=true]:text-foreground"

export const menuItemIconClass =
  "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground"
