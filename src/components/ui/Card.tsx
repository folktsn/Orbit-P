import { HTMLAttributes, forwardRef } from "react"
import { cn } from "@/lib/utils"

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "bg-white dark:bg-[#121212] border border-slate-100 dark:border-white/5 p-6 rounded-3xl shadow-sm text-slate-800 dark:text-slate-200 transition-colors duration-300",
        className
      )}
      {...props}
    />
  )
)
Card.displayName = "Card"
