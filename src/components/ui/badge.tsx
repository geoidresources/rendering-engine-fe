import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// HUD status variants (active / offline / alert / standby / tag) render as
// small uppercase pills with a leading colored dot. They sit alongside the
// stock shadcn variants so callers can use a single Badge component without
// reaching for a wrapper.
const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
        active:
          "h-auto gap-1.5 rounded-sm px-2 py-0.5 text-[10px] uppercase tracking-wider font-mono border bg-primary/10 text-primary border-primary/20 before:content-[''] before:block before:w-1.5 before:h-1.5 before:rounded-full before:bg-primary before:shrink-0",
        offline:
          "h-auto gap-1.5 rounded-sm px-2 py-0.5 text-[10px] uppercase tracking-wider font-mono border bg-destructive/10 text-destructive border-destructive/20 before:content-[''] before:block before:w-1.5 before:h-1.5 before:rounded-full before:bg-destructive before:shrink-0",
        alert:
          "h-auto gap-1.5 rounded-sm px-2 py-0.5 text-[10px] uppercase tracking-wider font-mono border bg-accent/10 text-accent border-accent/20 before:content-[''] before:block before:w-1.5 before:h-1.5 before:rounded-full before:bg-accent before:shrink-0",
        standby:
          "h-auto gap-1.5 rounded-sm px-2 py-0.5 text-[10px] uppercase tracking-wider font-mono border bg-secondary text-muted-foreground border-border before:content-[''] before:block before:w-1.5 before:h-1.5 before:rounded-full before:bg-muted-foreground before:shrink-0",
        tag:
          "h-auto gap-1.5 rounded-sm px-2 py-0.5 text-[10px] uppercase tracking-wider font-mono border bg-transparent text-muted-foreground border-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
