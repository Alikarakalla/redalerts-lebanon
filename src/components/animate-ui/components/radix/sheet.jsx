import * as React from 'react';

import {
  Sheet as SheetPrimitive,
  SheetTrigger as SheetTriggerPrimitive,
  SheetClose as SheetClosePrimitive,
  SheetPortal as SheetPortalPrimitive,
  SheetContent as SheetContentPrimitive,
  SheetHeader as SheetHeaderPrimitive,
  SheetFooter as SheetFooterPrimitive,
  SheetTitle as SheetTitlePrimitive,
  SheetDescription as SheetDescriptionPrimitive,
} from '@/components/animate-ui/primitives/radix/sheet';
import { cn } from '@/lib/utils';
import { XIcon } from 'lucide-react';

function Sheet(props) {
  return <SheetPrimitive {...props} />;
}

function SheetTrigger(props) {
  return <SheetTriggerPrimitive {...props} />;
}

function SheetClose(props) {
  return <SheetClosePrimitive {...props} />;
}

function SheetContent({
  className,
  children,
  side = 'right',
  showCloseButton = true,
  ...props
}) {
  return (
    <SheetPortalPrimitive>
      <SheetContentPrimitive
        className={cn(
          'fixed z-50 flex flex-col gap-4 border-white/10 bg-[#111315]/96 shadow-2xl backdrop-blur-xl',
          side === 'right' && 'h-full w-[min(88vw,24rem)] border-l',
          side === 'left' && 'h-full w-[min(88vw,24rem)] border-r',
          side === 'top' && 'h-[24rem] w-full border-b',
          side === 'bottom' && 'h-[24rem] w-full border-t',
          className
        )}
        side={side}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetClose className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10">
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </SheetClose>
        )}
      </SheetContentPrimitive>
    </SheetPortalPrimitive>
  );
}

function SheetHeader({ className, ...props }) {
  return <SheetHeaderPrimitive className={cn('flex flex-col gap-1.5 p-4', className)} {...props} />;
}

function SheetFooter({ className, ...props }) {
  return <SheetFooterPrimitive className={cn('mt-auto flex flex-col gap-2 p-4', className)} {...props} />;
}

function SheetTitle({ className, ...props }) {
  return <SheetTitlePrimitive className={cn('font-semibold text-white', className)} {...props} />;
}

function SheetDescription({ className, ...props }) {
  return <SheetDescriptionPrimitive className={cn('text-sm text-slate-400', className)} {...props} />;
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
