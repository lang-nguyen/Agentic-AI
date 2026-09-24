import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useLocale } from "@/contexts/locale.context";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className = "" }: BreadcrumbsProps) {
  const { t } = useLocale();

  return (
    <nav className={`text-xs text-slate-400 font-medium flex items-center gap-1.5 select-none ${className}`}>
      {/* Home link is always the root */}
      <Link href="/" className="hover:text-[#ff4e20] transition-colors">
        {t("home")}
      </Link>
      
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={index}>
            <ChevronRight className="size-3 text-slate-300 shrink-0" />
            {item.href && !isLast ? (
              <Link 
                href={item.href} 
                className="hover:text-[#ff4e20] transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className={`font-semibold truncate max-w-[200px] ${
                isLast ? "text-slate-600 font-semibold" : "text-slate-400 font-medium"
              }`}>
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
