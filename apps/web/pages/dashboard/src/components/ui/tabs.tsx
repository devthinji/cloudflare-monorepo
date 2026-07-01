import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'
import { cn } from '@/lib/utils'

export function Tabs({ value, onValueChange, className, children, ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root value={value} onValueChange={onValueChange} className={className} {...props}>
      {children}
    </TabsPrimitive.Root>
  )
}

export function TabsList({ className, children, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      className={cn('inline-flex items-center gap-1 rounded-lg bg-gray-100 p-1', className)}
      {...props}
    >
      {children}
    </TabsPrimitive.List>
  )
}

export function TabsTrigger({ className, children, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      className={cn(
        'inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all',
        'data-[selected]:bg-white data-[selected]:text-gray-900 data-[selected]:shadow-sm',
        'text-gray-500 hover:text-gray-700',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      {...props}
    >
      {children}
    </TabsPrimitive.Tab>
  )
}

export function TabsContent({ className, children, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel className={cn('', className)} {...props}>
      {children}
    </TabsPrimitive.Panel>
  )
}
