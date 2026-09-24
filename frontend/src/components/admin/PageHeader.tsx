import { Button } from "../common/ui/button";
import { Users } from "lucide-react";
import { Clock } from "lucide-react";
import { RefreshCw } from "lucide-react";
import { translations, Locale } from "@/locales/translations";
import { useEffect, useState } from "react";
import { useCallback } from "react";

export default function PageHeader() {

    const [locale, setLocale] = useState<Locale>("vi");
    useEffect(() => {
        if (typeof window !== "undefined") {
            const stored = localStorage.getItem("store:locale") as Locale;
            if (stored) setLocale(stored);
        }
    }, []);

    const t = useCallback((key: keyof typeof translations.vi): string => {
        const dict = translations[locale] || translations.vi;
        return dict[key] || translations.vi[key] || String(key);
    }, [locale]);

    {/* Top Header Panel */ }
    return <>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-100 p-6 rounded-2xl shadow-xs">
            <div className="flex items-center gap-3">
                <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600">
                    <RefreshCw className="size-6" />
                </div>
                <div className="flex flex-col">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 text-left">
                        Manage Return/Refund Requests
                    </h1>
                    <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
                        Review and process return and refund requests from customers.
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-3 self-end md:self-auto">
            </div>
        </div>
    </>
}