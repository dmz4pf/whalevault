# V7 Revised: Jumper-Style Centered Widget

## Constraints
- **LOCAL COMMITS ONLY** - No push to GitHub/Railway
- Keep dashboard as base, history page as separate route
- Revert/modify the slide-over panel system to centered widget

---

## Overview

Transform the right-sliding panel system into a **Jumper-style centered floating widget**:
- Compact card (~448px) floating centered on screen
- Dark blur backdrop
- Scale + fade animation (not slide)
- In-widget view stack with back button
- Escape/backdrop click to close

---

## Files to Modify

| File | Change |
|------|--------|
| `lib/layer-animations.ts` | Replace slide variants with scale+fade |
| `components/layers/Layer.tsx` | Centered card positioning, rounded corners |
| `components/layers/LayerStack.tsx` | Centered flex container, hide non-top layers |
| `components/layers/contents/*.tsx` | Remove Card wrapper, adjust spacing |

## Files to Keep (No Changes)
- `stores/layers.ts` - Push/pop navigation works as-is
- `types/layers.ts` - Type definitions unchanged

---

## Phase 1: Animation Variants

**File:** `frontend/lib/layer-animations.ts`

Replace `layerVariants` with:
```typescript
export const widgetVariants: Variants = {
  initial: { scale: 0.95, opacity: 0, y: 10 },
  active: { scale: 1, opacity: 1, y: 0, transition: LAYER_SPRING },
  inactive: { scale: 0.92, opacity: 0, pointerEvents: "none" as const },
  exit: { scale: 0.95, opacity: 0, y: 10, transition: { duration: 0.2 } },
};
```

---

## Phase 2: Layer Component

**File:** `frontend/components/layers/Layer.tsx`

Key changes:
- Remove: `fixed inset-y-0 right-0 max-w-2xl`
- Add: Centered card styling

```tsx
<motion.div
  variants={widgetVariants}
  className={cn(
    "relative flex flex-col",
    "w-full max-w-md mx-4",
    "max-h-[85vh]",
    "bg-bg/95 backdrop-blur-xl",
    "border border-terminal-green/20",
    "rounded-2xl",
    "shadow-2xl outline-none"
  )}
>
  {/* Simplified header */}
  <header className="flex items-center justify-between px-5 py-4 border-b border-terminal-green/10">
    <div className="flex items-center gap-3">
      {index > 0 && <BackButton onClick={onBack} />}
      <h2 className="text-lg font-heading text-terminal-green">{title}</h2>
    </div>
    <CloseButton onClick={onCloseAll} />
  </header>

  {/* Scrollable content */}
  <div className="flex-1 overflow-y-auto p-5">
    {children}
  </div>
</motion.div>
```

---

## Phase 3: LayerStack Container

**File:** `frontend/components/layers/LayerStack.tsx`

Change from right-aligned to centered:
```tsx
{/* Backdrop */}
<motion.div
  variants={backdropVariants}
  className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md"
  onClick={handleBackdropClick}
/>

{/* Centered container */}
<div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
  <AnimatePresence mode="sync">
    {layers.map((layer, index) => (
      <div
        key={layer.id}
        className={cn(
          "pointer-events-auto absolute",
          index !== layers.length - 1 && "hidden"
        )}
      >
        <LayerComponent ... />
      </div>
    ))}
  </AnimatePresence>
</div>
```

**Key:** Only top layer visible, others hidden but preserved for back navigation.

---

## Phase 4: Content Components

**Files:** `components/layers/contents/*.tsx`

For each content component:
1. Remove `<Card gradient>` wrapper
2. Reduce padding (Layer provides `p-5`)
3. Content flows directly in widget

This makes content more compact for the smaller widget.

---

## Verification

1. **TypeScript:** `cd frontend && npx tsc --noEmit`
2. **Visual Test:**
   - Dashboard → Click Shield → Widget appears centered
   - Press Escape → Widget closes
   - Click backdrop → Widget closes
   - Unshield → Select Swap action → New view pushes, back works
3. **Responsive:** Check mobile widths

---

## Rollback

If issues arise: `git reset --hard 3659d84` (last V7 commit) or `git reset --hard origin/main`
