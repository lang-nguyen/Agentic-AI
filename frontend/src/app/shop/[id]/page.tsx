"use client";

import React, { use, useState, useEffect } from "react";
import Link from "next/link";
import { ClientLayout } from "@/components/user/layout/ClientLayout";
import { API_CONFIG } from "@/config/api";
import { useCart } from "@/features/cart/useCart";
import { useLocale } from "@/contexts/locale.context";
import { Breadcrumbs } from "@/components/user/layout/Breadcrumbs";
import { 
  Star, 
  Truck, 
  RotateCcw, 
  ShieldCheck, 
  ShoppingBag,
  ArrowLeft,
  Sparkles,
  Heart,
  ChevronRight
} from "lucide-react";
import { toast } from "sonner";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ProductDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const { addToCart } = useCart();
  const { t } = useLocale();

  const [product, setProduct] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [activeImage, setActiveImage] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [liked, setLiked] = useState(false);
  const [imageAspect, setImageAspect] = useState<"portrait" | "landscape" | "square">("square");

  // Detect image aspect ratio
  useEffect(() => {
    if (activeImage) {
      const img = new Image();
      img.src = activeImage;
      img.onload = () => {
        const ratio = img.naturalWidth / img.naturalHeight;
        if (ratio < 0.8) {
          setImageAspect("portrait");
        } else if (ratio > 1.25) {
          setImageAspect("landscape");
        } else {
          setImageAspect("square");
        }
      };
    }
  }, [activeImage]);

  // Fetch product from backend
  useEffect(() => {
    async function loadProduct() {
      try {
        setLoading(true);
        const res = await fetch(`${API_CONFIG.webBackendBaseUrl}/api/products/${id}`);
        if (!res.ok) throw new Error("Product not found");
        const rawProd = await res.json();

        // Helper to get consistent rating and review count
        const getProductMetadata = (id: string): { rating: number; reviews: number } => {
          let hash = 0;
          for (let i = 0; i < id.length; i++) {
            hash = id.charCodeAt(i) + ((hash << 5) - hash);
          }
          const rating = 4.0 + (Math.abs(hash) % 10) / 10;
          const reviews = 20 + (Math.abs(hash) % 450);
          return { rating: parseFloat(rating.toFixed(1)), reviews };
        };

        // Get first variant price
        let price = 49.99;
        if (rawProd.variants) {
          const keys = Object.keys(rawProd.variants);
          if (keys.length > 0) {
            price = rawProd.variants[keys[0]].price || price;
          }
        }

        const { rating, reviews } = getProductMetadata(rawProd.productId);
        const mainImage = rawProd.mainImage || "/images/no-image.png";

        setProduct({
          id: rawProd.productId,
          name: rawProd.name,
          price: parseFloat(price.toFixed(2)),
          rating,
          reviews,
          image: mainImage,
          description: rawProd.displayName || rawProd.name,
          variants: rawProd.variants,
          optionImages: rawProd.optionImages,
        });
        setActiveImage(mainImage);
      } catch (err) {
        console.error(err);
        setProduct(null);
      } finally {
        setLoading(false);
      }
    }
    loadProduct();
  }, [id]);

  // Find all option names and their values
  const optionGroups = React.useMemo(() => {
    if (!product || !product.variants) return {};
    const groups: Record<string, Set<string>> = {};
    Object.values(product.variants).forEach((variant: any) => {
      if (variant.options) {
        Object.entries(variant.options).forEach(([key, val]) => {
          if (!groups[key]) {
            groups[key] = new Set<string>();
          }
          groups[key].add(val as string);
        });
      }
    });
    const result: Record<string, string[]> = {};
    Object.entries(groups).forEach(([key, set]) => {
      result[key] = Array.from(set);
    });
    return result;
  }, [product]);

  // Sync selected options when product loads
  useEffect(() => {
    if (product) {
      const initial: Record<string, string> = {};
      Object.entries(optionGroups).forEach(([key, values]) => {
        if (values.length > 0) {
          initial[key] = values[0];
        }
      });
      setSelectedOptions(initial);
    }
  }, [product, optionGroups]);

  // Find the active variant matching the selected options
  const activeVariant = React.useMemo<any>(() => {
    if (!product || !product.variants || Object.keys(selectedOptions).length === 0) return null;
    return Object.values(product.variants).find((variant: any) => {
      if (!variant.options) return false;
      return Object.entries(selectedOptions).every(([key, val]) => variant.options[key] === val);
    }) || null;
  }, [product, selectedOptions]);

  // Extract images of the currently active variant (based on selected option_images)
  const activeVariantImages = React.useMemo(() => {
    if (!product) return [];
    
    // Find matched visual images group
    if (product.optionImages && Object.keys(selectedOptions).length > 0) {
      const matched = product.optionImages.find((mapping: any) => {
        if (!mapping.options) return false;
        return Object.entries(mapping.options).every(([key, val]) => {
          return selectedOptions[key] === val;
        });
      });
      if (matched && matched.images && matched.images.length > 0) {
        return matched.images;
      }
    }
    
    // Fallback to main product image
    if (product.image) {
      return [product.image];
    }
    return [];
  }, [product, selectedOptions]);

  // Update active image when activeVariantImages changes
  useEffect(() => {
    if (activeVariantImages.length > 0) {
      setActiveImage(activeVariantImages[0]);
    }
  }, [activeVariantImages]);

  const handleAddToCart = () => {
    const itemId = activeVariant ? activeVariant.itemId : product.id;
    addToCart(itemId, product.name);
    toast.success(`Added ${quantity}x "${product.name}" to cart!`);
  };

  if (loading) {
    return (
      <ClientLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 flex flex-col items-center justify-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-600"></div>
          <p className="text-slate-500 font-medium">Loading product details...</p>
        </div>
      </ClientLayout>
    );
  }

  if (!product) {
    return (
      <ClientLayout>
        <div className="max-w-md mx-auto text-center py-20 space-y-6">
          <div className="text-slate-400 text-5xl">⚠️</div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-display">Product Not Found</h2>
          <p className="text-xs text-slate-500">The product ID you requested does not exist in the database.</p>
          <Link 
            href="/shop"
            className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold py-2.5 px-6 rounded-xl shadow-md transition-all cursor-pointer"
          >
            <ArrowLeft className="size-3.5" />
            <span>{t("backToCatalog")}</span>
          </Link>
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 text-left animate-in fade-in duration-300">
        
        {/* E-Commerce UX Principle 1: Breadcrumbs for clear orientation */}
        <Breadcrumbs 
          items={[
            { label: t("shopCatalog"), href: "/shop" },
            { label: product.name }
          ]} 
        />

        {/* Back navigation */}
        <Link 
          href="/shop" 
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-orange-600 transition-colors"
        >
          <ArrowLeft className="size-4" />
          <span>{t("backToCatalog")}</span>
        </Link>

        {/* E-Commerce UX Principle: Dedicated Product Page Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Visual Showcase */}
          <div className="lg:col-span-6 space-y-4">
            <div className="w-full aspect-square bg-white rounded-2xl p-6 text-slate-800 flex flex-col justify-between relative shadow-sm overflow-hidden select-none border border-slate-200 transition-all duration-300">
              {activeImage ? (
                <img 
                  src={activeImage} 
                  alt={product.name} 
                  className="absolute inset-0 w-full h-full z-0 object-contain p-4"
                />
              ) : (
                <>
                  <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:20px_20px] z-0" />
                  <div className="absolute inset-0 bg-slate-100 z-0" />
                </>
              )}
              
              <div className="flex justify-end items-center relative z-20 w-full">
                <button 
                  onClick={() => {
                    setLiked(!liked);
                    toast.success(liked ? "Removed from Wishlist" : "Added to Wishlist");
                  }}
                  className="h-10 w-10 rounded-full bg-white/90 hover:bg-white shadow-md text-slate-600 flex items-center justify-center transition-all cursor-pointer hover:scale-105 border border-slate-100"
                >
                  <Heart className={`size-5 transition-colors ${liked ? "fill-rose-500 text-rose-500" : "text-slate-600"}`} />
                </button>
              </div>
            </div>

            {/* Active Variant thumbnails list */}
            {activeVariantImages.length > 1 && (
              <div className="grid grid-cols-4 gap-3 select-none animate-in fade-in duration-300">
                {activeVariantImages.map((imgUrl: string, i: number) => (
                  <button 
                    key={imgUrl} 
                    onClick={() => setActiveImage(imgUrl)}
                    className={`h-20 rounded-xl border transition-all cursor-pointer relative overflow-hidden flex items-center justify-center ${
                      activeImage === imgUrl ? "border-orange-600 ring-2 ring-orange-500/20" : "border-slate-200 hover:border-slate-350"
                    }`}
                  >
                    <img src={imgUrl} alt={`Variant Thumbnail ${i+1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Detailed Purchase Controls */}
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-3xs space-y-6">
            
            {/* Header info */}
            <div className="border-b pb-4 space-y-3">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-850 font-display">{product.name}</h2>
              
              {/* Rating block */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <div className="flex text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="size-3.5 fill-current" />
                  ))}
                </div>
                <span className="font-bold text-slate-655">
                  {product.rating} / 5.0 ({product.reviews} customer reviews)
                </span>
              </div>
            </div>

            {/* Price details */}
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">
                ${activeVariant ? activeVariant.price.toFixed(2) : product.price.toFixed(2)}
              </span>
              {activeVariant ? (
                activeVariant.available ? (
                  <span className="text-xs text-emerald-650 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full font-bold animate-in fade-in duration-300">
                    In Stock
                  </span>
                ) : (
                  <span className="text-xs text-rose-650 bg-rose-50 border border-rose-100 px-2.5 py-0.5 rounded-full font-bold animate-in fade-in duration-300">
                    Out of Stock
                  </span>
                )
              ) : (
                <span className="text-xs text-emerald-650 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full font-bold">
                  Available
                </span>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5 text-xs leading-relaxed text-slate-600">
              <h4 className="font-extrabold text-slate-400 uppercase tracking-widest text-[10px]">Product Description</h4>
              <p>{product.description}</p>
            </div>

            {/* Dynamic Option Selectors */}
            {Object.keys(optionGroups).length > 0 && (
              <div className="space-y-4 border-t border-b py-4">
                {Object.entries(optionGroups).map(([optionName, optionValues]) => (
                  <div key={optionName} className="space-y-1.5 text-left">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                      Select {optionName}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {optionValues.map((val) => (
                        <button
                          key={val}
                          onClick={() => setSelectedOptions(prev => ({ ...prev, [optionName]: val }))}
                          className={`px-3 py-1.5 text-xs rounded-lg border font-bold transition-all cursor-pointer ${
                            selectedOptions[optionName] === val 
                              ? "bg-slate-900 text-white border-slate-900 shadow-3xs" 
                              : "border-slate-200 bg-white text-slate-655 hover:bg-slate-50"
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quantity Selector & Add to Cart button */}
            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
              {/* Quantity */}
              <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden self-start shrink-0">
                <button 
                  onClick={() => setQuantity(q => Math.max(q - 1, 1))}
                  className="px-3.5 py-2.5 text-slate-500 hover:bg-slate-50 font-bold transition-colors cursor-pointer"
                >
                  -
                </button>
                <span className="px-4 py-2 text-xs font-bold text-slate-880">{quantity}</span>
                <button 
                  onClick={() => setQuantity(q => q + 1)}
                  className="px-3.5 py-2.5 text-slate-500 hover:bg-slate-50 font-bold transition-colors cursor-pointer"
                >
                  +
                </button>
              </div>

              {/* Add to Cart CTA */}
              <button
                onClick={handleAddToCart}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-orange-600/15 transition-all hover:scale-102 cursor-pointer duration-150"
              >
                <ShoppingBag className="size-4.5" />
                <span>{t("addToCartSuccess")}</span>
              </button>
            </div>

            {/* Value props list */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100 text-[10px] text-slate-550 font-semibold leading-relaxed">
              <div className="flex flex-col items-center text-center space-y-1">
                <Truck className="size-4 text-orange-600 shrink-0" />
                <span>{t("freeShipping")}</span>
              </div>
              <div className="flex flex-col items-center text-center space-y-1">
                <RotateCcw className="size-4 text-orange-600 shrink-0" />
                <span>30-Day Free Returns</span>
              </div>
              <div className="flex flex-col items-center text-center space-y-1">
                <ShieldCheck className="size-4 text-orange-600 shrink-0" />
                <span>Secure Checkout API</span>
              </div>
            </div>

            {/* Sandbox Testing Guide customized for E-commerce Policy */}
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 text-left space-y-2 text-xs text-orange-950">
              <div className="flex items-center gap-1.5 font-bold text-orange-850">
                <Sparkles className="size-4" />
                <span>{t("sandboxGuide")}: {product.name}</span>
              </div>
              <p className="leading-relaxed">
                This item is stored as Product ID <code className="font-mono bg-white px-1 py-0.2 rounded border">{product.id}</code> in the database. When you talk to the AI support chatbot on the bottom right:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-[11px] font-medium leading-normal text-orange-950/80">
                <li>You can ask the AI agent: <strong>"Do you have {product.name} in stock?"</strong> or <strong>"What variants are available for {product.name}?"</strong></li>
                <li>If you log in to a profile in the Account page, you can request order modifications or return exchanges for this exact product category!</li>
              </ul>
            </div>

          </div>

        </div>

      </div>
    </ClientLayout>
  );
}
