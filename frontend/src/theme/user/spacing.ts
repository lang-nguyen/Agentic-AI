/**
 * Layout, Spacing & Layers System for Customer Storefront (User)
 * Optimized for compact, high-density layouts
 */

export const spacing = {
  // Navigation & Header offsets
  headerHeight: "h-16",
  stickyHeaderOffset: "top-16",
  stickySidebarOffset: "lg:top-24",

  // Page Containers
  layoutPadding: "px-4 sm:px-5 lg:px-6 py-4",
  layoutPx: "px-4 sm:px-5 lg:px-6",
  sectionGap: "space-y-2.5",
  gridGap: "gap-3.5",

  // Card & Panel Interiors
  cardPadding: "p-4 md:p-5",
  cardPaddingDense: "p-2.5 sm:p-3",
  inputPadding: "px-3 py-2",
  buttonPadding: "px-4 py-1.5",
  buttonPaddingDense: "px-2.5 py-1",

  // Internal Spacings
  elementGap: "space-y-2",
  itemGap: "space-y-2",
  badgePadding: "px-1.5 py-0.5"
};

export const zIndex = {
  header: "z-40",
  breadcrumbs: "z-30",
  dropdown: "z-50",
  toast: "z-50"
};
