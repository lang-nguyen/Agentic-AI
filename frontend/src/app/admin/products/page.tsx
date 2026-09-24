"use client";

import React, { useState, useEffect } from "react";
import { 
  Package, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  ArrowUpDown, 
  X, 
  DollarSign,
  Sparkles,
  Layers,
  Image as ImageIcon,
  Check,
  Eye
} from "lucide-react";
import { toast } from "sonner";
import { API_CONFIG } from "@/config/api";

export default function AdminProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "price-asc" | "price-desc">("name");
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<"basic" | "variants" | "images">("basic");

  // Pending upload files states
  const [pendingMainFile, setPendingMainFile] = useState<File | null>(null);
  const [pendingOptionFiles, setPendingOptionFiles] = useState<Record<string, File>>({});
  const [uploading, setUploading] = useState(false);

  // Form states
  const [formData, setFormData] = useState<any>({
    name: "",
    displayName: "",
    mainImage: "",
    variants: [] as any[], 
    optionImages: [] as any[], 
  });

  // Upload image to Cloudinary via backend
  const handleUploadImage = async (file: File): Promise<string> => {
    const token = localStorage.getItem("store:token");
    const form = new FormData();
    form.append("file", file);

    const res = await fetch(`${API_CONFIG.webBackendBaseUrl}/api/admin/products/upload`, {
      method: "POST",
      headers: {
        "Authorization": token ? `Bearer ${token}` : "",
      },
      body: form,
    });

    if (!res.ok) {
      const errMsg = await res.text();
      throw new Error(errMsg || "Tải ảnh lên thất bại");
    }

    const data = await res.json();
    return data.url;
  };

  // Load products from backend on mount
  const fetchProducts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("store:token");
      const res = await fetch(`${API_CONFIG.webBackendBaseUrl}/api/admin/products?size=1000`, {
        headers: {
          "Authorization": token ? `Bearer ${token}` : "",
        }
      });
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Không có quyền truy cập. Vui lòng đăng nhập tài khoản Admin.");
        }
        throw new Error("Không thể tải danh sách sản phẩm từ backend");
      }
      const data = await res.json();
      setProducts(data.content || []);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Lỗi tải sản phẩm");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Open modal for creating a new product
  const handleAddClick = () => {
    setEditingProduct(null);
    setFormData({
      name: "",
      displayName: "",
      mainImage: "",
      attributeNames: ["color", "size"],
      variants: [
        {
          id: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
          itemId: "",
          price: 49.99,
          available: true,
          options: [
            { key: "color", value: "blue" },
            { key: "size", value: "M" }
          ]
        }
      ],
      optionImages: [
        {
          optionName: "color",
          optionValue: "blue",
          images: ["https://m.media-amazon.com/images/I/71oMWecayHL._AC_SX679_.jpg"]
        }
      ]
    });
    setPendingMainFile(null);
    setPendingOptionFiles({});
    setUploading(false);
    setActiveTab("basic");
    setIsModalOpen(true);
  };

  // Open modal for editing a product
  const handleEditClick = (product: any) => {
    setEditingProduct(product);
    
    // Gather unique attribute names from variants
    const keysSet = new Set<string>();
    if (product.variants) {
      Object.values(product.variants).forEach((v: any) => {
        if (v.options) {
          Object.keys(v.options).forEach(k => keysSet.add(k));
        }
      });
    }
    const attrNames = Array.from(keysSet);
    if (attrNames.length === 0) {
      attrNames.push("color", "size");
    }

    // Parse variants map to UI array
    const variantsList = product.variants ? Object.entries(product.variants).map(([k, v]: [string, any]) => {
      // Ensure all global attrNames exist in this variant's options list
      const optionsArray = attrNames.map((name) => {
        const val = v.options ? v.options[name] || "" : "";
        return { key: name, value: val };
      });
      return {
        id: k,
        itemId: v.item_id || k,
        price: v.price || 0,
        available: v.available !== undefined ? v.available : true,
        options: optionsArray
      };
    }) : [];

    // Parse optionImages list to UI array
    const optionImagesList = product.optionImages ? product.optionImages.map((item: any) => {
      const optionsEntries = item.options ? Object.entries(item.options) : [];
      const [optName, optVal] = optionsEntries.length > 0 ? optionsEntries[0] : ["color", ""];
      return {
        optionName: optName,
        optionValue: optVal,
        images: item.images || []
      };
    }) : [];

    setFormData({
      name: product.name || "",
      displayName: product.displayName || "",
      mainImage: product.mainImage || "",
      attributeNames: attrNames,
      variants: variantsList,
      optionImages: optionImagesList
    });
    setPendingMainFile(null);
    setPendingOptionFiles({});
    setUploading(false);
    setActiveTab("basic");
    setIsModalOpen(true);
  };

  // Delete product handler
  const handleDeleteClick = async (productId: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa sản phẩm này không?")) {
      try {
        const token = localStorage.getItem("store:token");
        const res = await fetch(`${API_CONFIG.webBackendBaseUrl}/api/admin/products/${productId}`, {
          method: "DELETE",
          headers: {
            "Authorization": token ? `Bearer ${token}` : "",
          }
        });
        if (!res.ok) throw new Error("Xóa sản phẩm từ server thất bại");
        toast.success("Đã xóa sản phẩm thành công!");
        fetchProducts();
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || "Lỗi xóa sản phẩm");
      }
    }
  };

  // Helpers for editing variants list
  const updateVariantField = (index: number, field: string, value: any) => {
    const updated = [...formData.variants];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, variants: updated });
  };

  const addAttributeName = (name: string) => {
    const cleanName = name.toLowerCase().trim();
    if (!cleanName) return;
    if (formData.attributeNames.includes(cleanName)) {
      toast.error("Thuộc tính này đã tồn tại!");
      return;
    }
    
    const updatedNames = [...formData.attributeNames, cleanName];
    const updatedVariants = formData.variants.map((v: any) => {
      const options = [...v.options];
      if (!options.some(opt => opt.key === cleanName)) {
        options.push({ key: cleanName, value: "" });
      }
      return { ...v, options };
    });
    setFormData({ ...formData, attributeNames: updatedNames, variants: updatedVariants });
  };

  const removeAttributeName = (name: string) => {
    const updatedNames = formData.attributeNames.filter((n: string) => n !== name);
    const updatedVariants = formData.variants.map((v: any) => {
      return {
        ...v,
        options: v.options.filter((opt: any) => opt.key !== name)
      };
    });
    setFormData({ ...formData, attributeNames: updatedNames, variants: updatedVariants });
  };

  const addVariantRow = () => {
    const defaultOptions = formData.attributeNames.map((name: string) => ({
      key: name,
      value: ""
    }));
    const newVar = {
      id: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
      itemId: "",
      price: 49.99,
      available: true,
      options: defaultOptions
    };
    setFormData({ ...formData, variants: [...formData.variants, newVar] });
  };

  const deleteVariantRow = (index: number) => {
    const updated = formData.variants.filter((_: any, i: number) => i !== index);
    setFormData({ ...formData, variants: updated });
  };

  // Helpers for editing option images list
  const addOptionImageGroup = () => {
    const newGroup = {
      optionName: "color",
      optionValue: "",
      images: [""]
    };
    setFormData({ ...formData, optionImages: [...formData.optionImages, newGroup] });
  };

  const updateOptionImageGroupField = (index: number, field: "optionName" | "optionValue", value: string) => {
    const updated = [...formData.optionImages];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, optionImages: updated });
  };

  const deleteOptionImageGroup = (index: number) => {
    const updated = formData.optionImages.filter((_: any, i: number) => i !== index);
    setFormData({ ...formData, optionImages: updated });
  };

  const addImageUrlToGroup = (gIndex: number) => {
    const updated = [...formData.optionImages];
    updated[gIndex].images.push("");
    setFormData({ ...formData, optionImages: updated });
  };

  const updateImageUrlInGroup = (gIndex: number, imgIndex: number, value: string) => {
    const updated = [...formData.optionImages];
    updated[gIndex].images[imgIndex] = value;
    setFormData({ ...formData, optionImages: updated });
  };

  const deleteImageUrlInGroup = (gIndex: number, imgIndex: number) => {
    const updated = [...formData.optionImages];
    updated[gIndex].images = updated[gIndex].images.filter((_: any, i: number) => i !== imgIndex);
    setFormData({ ...formData, optionImages: updated });
  };

  // Submit Handler for Create & Update
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { name, displayName, mainImage, variants, optionImages } = formData;

    if (!name.trim() || !displayName.trim()) {
      toast.error("Vui lòng điền đầy đủ tên và tên hiển thị sản phẩm!");
      return;
    }

    setUploading(true);

    try {
      // 1. Upload mainImage if pending
      let finalMainImage = mainImage.trim();
      if (pendingMainFile) {
        toast.loading("Đang tải ảnh đại diện chính lên Cloudinary...");
        try {
          finalMainImage = await handleUploadImage(pendingMainFile);
        } catch (err: any) {
          throw new Error("Không thể tải lên ảnh đại diện: " + err.message);
        } finally {
          toast.dismiss();
        }
      }

      // 2. Upload option images if pending
      const optionImagesPayload = await Promise.all(
        optionImages.map(async (group: any, gIdx: number) => {
          const images = await Promise.all(
            group.images.map(async (img: string, imgIdx: number) => {
              const key = `${gIdx}-${imgIdx}`;
              const pendingFile = pendingOptionFiles[key];
              if (pendingFile) {
                toast.loading(`Đang tải ảnh bộ sưu tập (${group.optionValue || 'chờ'}) lên Cloudinary...`);
                try {
                  return await handleUploadImage(pendingFile);
                } catch (err: any) {
                  throw new Error(`Không thể tải lên ảnh bộ sưu tập: ` + err.message);
                } finally {
                  toast.dismiss();
                }
              }
              return img;
            })
          );
          const cleanedImages = images.filter((i: string) => i.trim() !== "");
          return {
            options: { [group.optionName.toLowerCase().trim()]: group.optionValue.trim() },
            images: cleanedImages
          };
        })
      );

      const filteredOptionImages = optionImagesPayload.filter(
        (group: any) => Object.keys(group.options)[0] !== "" && group.images.length > 0
      );

      // 3. Convert variants array to Map<String, Variant>
      const variantsMap: Record<string, any> = {};
      variants.forEach((v: any) => {
        const key = v.id || Math.floor(1000000000 + Math.random() * 9000000000).toString();
        const optionsMap: Record<string, string> = {};
        v.options.forEach((opt: any) => {
          if (opt.key.trim() && opt.value.trim()) {
            optionsMap[opt.key.toLowerCase().trim()] = opt.value.trim();
          }
        });
        variantsMap[key] = {
          item_id: key,
          options: optionsMap,
          available: v.available,
          price: parseFloat(v.price) || 0
        };
      });

      if (Object.keys(variantsMap).length === 0) {
        toast.error("Sản phẩm phải có ít nhất một biến thể (Variant)!");
        setUploading(false);
        return;
      }

      const payload = {
        productId: editingProduct ? editingProduct.productId : undefined,
        name: name.trim(),
        displayName: displayName.trim(),
        mainImage: finalMainImage,
        variants: variantsMap,
        optionImages: filteredOptionImages
      };

      const token = localStorage.getItem("store:token");
      const url = editingProduct 
        ? `${API_CONFIG.webBackendBaseUrl}/api/admin/products/${editingProduct.productId}`
        : `${API_CONFIG.webBackendBaseUrl}/api/admin/products`;
      
      const method = editingProduct ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Lưu sản phẩm thất bại");
      }

      toast.success(editingProduct ? "Cập nhật sản phẩm thành công!" : "Thêm sản phẩm mới thành công!");
      setPendingMainFile(null);
      setPendingOptionFiles({});
      setIsModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Lỗi khi lưu sản phẩm");
    } finally {
      setUploading(false);
    }
  };

  // Filtering
  const filteredProducts = products.filter((product) => {
    const matchesSearch = 
      (product.name || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
      (product.displayName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.productId || "").includes(searchQuery);
    return matchesSearch;
  });

  // Sorting
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === "name") {
      return (a.name || "").localeCompare(b.name || "");
    }
    if (sortBy === "price-asc") {
      return (a.minPrice || 0) - (b.minPrice || 0);
    }
    if (sortBy === "price-desc") {
      return (b.minPrice || 0) - (a.minPrice || 0);
    }
    return 0;
  });

  // Pagination calculation
  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);
  const paginatedProducts = sortedProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Statistics calculation
  const totalProducts = products.length;
  const avgPrice = totalProducts > 0 
    ? (products.reduce((acc, p) => acc + (p.minPrice || 0), 0) / totalProducts).toFixed(2) 
    : "0.00";

  return (
    <div className="p-6 space-y-6 w-full max-w-7xl mx-auto text-left select-none">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Package className="size-7 text-indigo-600" />
            <span>Quản Lý Sản Phẩm</span>
          </h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Xem, thêm mới, cập nhật và quản lý kho hàng sản phẩm Laki Shop trực tiếp từ DB
          </p>
        </div>
        
        <button
          onClick={handleAddClick}
          className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black px-4 py-3 rounded-2xl shadow-md hover:shadow-lg transition-all cursor-pointer border-none"
        >
          <Plus className="size-4" />
          <span>Thêm sản phẩm</span>
        </button>
      </div>

      {/* KPI Stats Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Total Products */}
        <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Package className="size-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Tổng Sản Phẩm</span>
            <span className="text-xl font-black text-slate-800 block mt-0.5">{totalProducts}</span>
          </div>
        </div>

        {/* Avg Price */}
        <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl">
            <DollarSign className="size-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Giá Trung Bình</span>
            <span className="text-xl font-black text-slate-800 block mt-0.5">${avgPrice}</span>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white border border-slate-200/60 rounded-3xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-grow max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Tìm kiếm sản phẩm theo tên, ID, hoặc mô tả..."
            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 font-medium placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
          />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="size-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 text-slate-650 text-xs font-bold px-3 py-2.5 rounded-xl focus:outline-none focus:bg-white focus:border-indigo-500 cursor-pointer"
            >
              <option value="name">Sắp xếp theo Tên (A-Z)</option>
              <option value="price-asc">Giá: Thấp đến Cao</option>
              <option value="price-desc">Giá: Cao đến Thấp</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Tabular List */}
      <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
            <span className="text-xs text-slate-400 font-bold">Đang tải sản phẩm từ máy chủ...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-6 py-4 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 w-24">Hình ảnh</th>
                  <th className="px-6 py-4 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 w-32">Mã sản phẩm</th>
                  <th className="px-6 py-4 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Tên sản phẩm</th>
                  <th className="px-6 py-4 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Đơn giá tối thiểu</th>
                  <th className="px-6 py-4 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 w-28 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedProducts.length > 0 ? (
                  paginatedProducts.map((product) => (
                    <tr key={product.productId} className="hover:bg-slate-50/30 transition-colors">
                      
                      {/* Real Image Preview */}
                      <td className="px-6 py-4">
                        {product.mainImage ? (
                          <img 
                            src={product.mainImage} 
                            alt={product.name} 
                            className="h-12 w-12 rounded-2xl object-cover shadow-2xs border border-slate-150"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 text-[10px] font-extrabold border border-slate-200">
                            NO IMG
                          </div>
                        )}
                      </td>

                      {/* Product ID Code badge */}
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs text-slate-500 font-semibold bg-slate-100 px-2 py-1 rounded-md">
                          {product.productId}
                        </span>
                      </td>

                      {/* Name & Display Title */}
                      <td className="px-6 py-4">
                        <div className="space-y-0.5">
                          <span className="text-xs font-black text-slate-800 block truncate max-w-xs">{product.name}</span>
                          <span className="text-[10px] text-slate-400 font-semibold block line-clamp-1 max-w-xs">
                            {product.displayName || product.name}
                          </span>
                        </div>
                      </td>

                      {/* Price formatted */}
                      <td className="px-6 py-4">
                        <span className="text-xs font-black text-slate-700">${(product.minPrice || 0).toFixed(2)}</span>
                      </td>

                      {/* Actions button group */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEditClick(product)}
                            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer border-none bg-transparent"
                            title="Sửa sản phẩm"
                          >
                            <Edit className="size-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(product.productId)}
                            className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer border-none bg-transparent"
                            title="Xóa sản phẩm"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-xs text-slate-400 font-bold">
                      Không tìm thấy sản phẩm nào phù hợp với bộ lọc tìm kiếm.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && totalPages > 1 && (
          <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
              Trang {currentPage} / {totalPages}
            </span>
            
            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="px-3 py-1.5 border border-slate-200 hover:border-slate-300 disabled:opacity-40 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
              >
                Trước
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="px-3 py-1.5 border border-slate-200 hover:border-slate-300 disabled:opacity-40 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
              >
                Sau
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Visual Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          
          {/* Backdrop Blur */}
          <div 
            onClick={() => setIsModalOpen(false)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" 
          />

          {/* Dialog Container */}
          <div className="relative bg-white border border-slate-200 rounded-3xl p-6 max-w-4xl w-full shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto flex flex-col">
            
            {/* Horizontal Loading Bar */}
            {uploading && (
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-100 overflow-hidden rounded-t-3xl">
                <div className="h-full bg-indigo-600 animate-pulse w-full" />
              </div>
            )}

            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                <Sparkles className="size-5 text-indigo-600" />
                <span>{editingProduct ? "Cập Nhật Sản Phẩm" : "Thêm Sản Phẩm Mới"}</span>
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer border-none bg-transparent"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Premium Tab Navigation Selector */}
            <div className="flex border-b border-slate-100">
              <button
                type="button"
                onClick={() => setActiveTab("basic")}
                className={`py-2.5 px-4 text-xs font-black border-b-2 transition-all flex items-center gap-2 cursor-pointer bg-transparent border-none ${
                  activeTab === "basic" 
                    ? "border-indigo-600 text-indigo-600" 
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                <Package className="size-4" />
                <span>Thông tin cơ bản</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("variants")}
                className={`py-2.5 px-4 text-xs font-black border-b-2 transition-all flex items-center gap-2 cursor-pointer bg-transparent border-none ${
                  activeTab === "variants" 
                    ? "border-indigo-600 text-indigo-600" 
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                <Layers className="size-4" />
                <span>Phân loại & Biến thể ({formData.variants?.length || 0})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("images")}
                className={`py-2.5 px-4 text-xs font-black border-b-2 transition-all flex items-center gap-2 cursor-pointer bg-transparent border-none ${
                  activeTab === "images" 
                    ? "border-indigo-600 text-indigo-600" 
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                <ImageIcon className="size-4" />
                <span>Ảnh theo thuộc tính ({formData.optionImages?.length || 0})</span>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between space-y-4">
              
              {/* Tab 1: Basic Info */}
              {activeTab === "basic" && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left Column: Form Fields */}
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Tên sản phẩm *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="VD: Smart Kettle, Cotton T-Shirt..."
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 font-medium focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Tiêu đề chi tiết sản phẩm (Display Name) *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.displayName}
                          onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                          placeholder="VD: Men's Crew Neck Cotton T-Shirt..."
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 font-medium focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Tải lên hoặc URL Ảnh đại diện chính (Main Image)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={formData.mainImage}
                            onChange={(e) => {
                              setFormData({ ...formData, mainImage: e.target.value });
                              setPendingMainFile(null); // Clear pending file if URL is edited manually
                            }}
                            placeholder="https://example.com/image.jpg"
                            className="flex-grow px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 font-medium focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                          />
                          <label className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black text-xs px-4 py-3 rounded-2xl border border-indigo-150 cursor-pointer inline-flex items-center gap-1.5 transition-all shrink-0">
                            <ImageIcon className="size-4" />
                            <span>Chọn tệp</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setPendingMainFile(file);
                                  const localUrl = URL.createObjectURL(file);
                                  setFormData({ ...formData, mainImage: localUrl });
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Image Preview Box (Perfect Square with square placeholder) */}
                    <div className="relative w-full aspect-square max-w-[260px] mx-auto flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl p-6 bg-slate-50/50 overflow-hidden">
                      {formData.mainImage ? (
                        <div className="absolute inset-2 bg-white rounded-2xl overflow-hidden flex items-center justify-center p-2 shadow-3xs">
                          <img 
                            src={formData.mainImage} 
                            alt="Main Image Preview" 
                            className="w-full h-full object-contain"
                            onError={(e: any) => {
                              e.target.src = "https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?w=500";
                            }}
                          />
                        </div>
                      ) : (
                        <div className="text-center space-y-2">
                          <ImageIcon className="size-10 text-slate-300 mx-auto animate-pulse" />
                          <span className="text-xs text-slate-400 font-semibold block">Chưa có ảnh đại diện</span>
                          <span className="text-[10px] text-slate-400 block max-w-[180px] mx-auto">Chọn tệp hình ảnh hoặc dán URL để xem trước tại đây</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Variants Manager Grid */}
              {activeTab === "variants" && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  
                  {/* Global Attribute Names Tags Manager */}
                  <div className="space-y-2.5 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Các thuộc tính bắt buộc của biến thể (Attribute Keys)</span>
                      <span className="text-[9px] text-slate-400 font-semibold italic">Nhập tên các khóa thuộc tính chung (VD: color, size)</span>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 items-center">
                      {formData.attributeNames?.map((name: string, idx: number) => (
                        <span 
                          key={idx} 
                          className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-xs font-black px-2.5 py-1 rounded-full border border-indigo-150 shadow-3xs"
                        >
                          <span>{name}</span>
                          <button
                            type="button"
                            onClick={() => removeAttributeName(name)}
                            className="p-0.5 hover:bg-indigo-150 rounded-full cursor-pointer border-none bg-transparent flex items-center justify-center"
                            title="Xóa thuộc tính khỏi tất cả biến thể"
                          >
                            <X className="size-3 text-indigo-500" />
                          </button>
                        </span>
                      ))}

                      {/* Inline Attribute Add Form */}
                      <div className="flex items-center gap-1.5 ml-1">
                        <input
                          type="text"
                          placeholder="Thêm thuộc tính (VD: style)"
                          id="new-attr-name-input"
                          className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none max-w-[150px]"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const val = e.currentTarget.value.trim();
                              if (val) {
                                addAttributeName(val);
                                e.currentTarget.value = "";
                              }
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const input = document.getElementById("new-attr-name-input") as HTMLInputElement;
                            if (input && input.value.trim()) {
                              addAttributeName(input.value.trim());
                              input.value = "";
                            }
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black px-2.5 py-1 rounded-lg border-none cursor-pointer"
                        >
                          Thêm
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <span className="text-xs font-bold text-slate-500">Danh sách các biến thể của sản phẩm</span>
                    <button
                      type="button"
                      onClick={addVariantRow}
                      className="inline-flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-black px-3.5 py-2 rounded-xl transition-all cursor-pointer border-none"
                    >
                      <Plus className="size-4" />
                      <span>Thêm biến thể</span>
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {formData.variants.map((v: any, vIdx: number) => (
                      <div key={v.id} className="bg-slate-50/70 border rounded-2xl p-4 space-y-3 relative">
                        {/* Title header for variant */}
                        <div className="flex items-center justify-between border-b pb-2">
                          <span className="text-xs font-black text-indigo-600">Biến thể #{vIdx + 1}</span>
                          <button
                            type="button"
                            onClick={() => deleteVariantRow(vIdx)}
                            className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all border-none bg-transparent cursor-pointer"
                            title="Xóa biến thể"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                          {/* Options mapping block */}
                          <div className="sm:col-span-2 space-y-2">
                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">Thông số lựa chọn</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {formData.attributeNames?.map((name: string) => {
                                const opt = v.options?.find((o: any) => o.key === name) || { key: name, value: "" };
                                return (
                                  <div key={name} className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-500 min-w-[70px] truncate capitalize">{name}:</span>
                                    <input
                                      type="text"
                                      required
                                      value={opt.value}
                                      onChange={(e) => {
                                        const updatedVariants = [...formData.variants];
                                        const variantOptions = [...updatedVariants[vIdx].options];
                                        const optIdx = variantOptions.findIndex((o: any) => o.key === name);
                                        if (optIdx >= 0) {
                                          variantOptions[optIdx] = { ...variantOptions[optIdx], value: e.target.value };
                                        } else {
                                          variantOptions.push({ key: name, value: e.target.value });
                                        }
                                        updatedVariants[vIdx] = { ...updatedVariants[vIdx], options: variantOptions };
                                        setFormData({ ...formData, variants: updatedVariants });
                                      }}
                                      placeholder={`Nhập ${name}...`}
                                      className="flex-grow px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Price & availability controls */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">Giá ($)</span>
                              <input
                                type="number"
                                step="0.01"
                                required
                                value={v.price}
                                onChange={(e) => updateVariantField(vIdx, "price", e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:border-indigo-500"
                              />
                            </div>

                            <div className="space-y-1 text-center flex flex-col justify-center items-center">
                              <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Mở bán</span>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={v.available}
                                  onChange={(e) => updateVariantField(vIdx, "available", e.target.checked)}
                                  className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                              </label>
                            </div>
                          </div>

                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 3: Option Images Manager */}
              {activeTab === "images" && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500">Liên kết thư viện ảnh cụ thể theo từng nhóm màu sắc/kiểu dáng (Ví dụ: màu Đỏ sẽ có bộ sưu tập ảnh màu Đỏ)</span>
                    <button
                      type="button"
                      onClick={addOptionImageGroup}
                      className="inline-flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-black px-3.5 py-2 rounded-xl transition-all cursor-pointer border-none"
                    >
                      <Plus className="size-4" />
                      <span>Thêm nhóm ảnh</span>
                    </button>
                  </div>

                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                    {formData.optionImages.map((group: any, gIdx: number) => (
                      <div key={gIdx} className="bg-slate-50/70 border rounded-2xl p-4 space-y-3">
                        {/* Group Header definition */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-2">
                          <div className="flex items-center gap-2 flex-grow max-w-md">
                            <span className="text-xs font-black text-indigo-600 whitespace-nowrap">Bộ ảnh cho:</span>
                            <input
                              type="text"
                              required
                              value={group.optionName}
                              onChange={(e) => updateOptionImageGroupField(gIdx, "optionName", e.target.value)}
                              placeholder="Tên thuộc tính (VD: color)"
                              className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold max-w-[120px]"
                            />
                            <span className="text-xs text-slate-400">=</span>
                            <input
                              type="text"
                              required
                              value={group.optionValue}
                              onChange={(e) => updateOptionImageGroupField(gIdx, "optionValue", e.target.value)}
                              placeholder="Giá trị (VD: blue)"
                              className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteOptionImageGroup(gIdx)}
                            className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all border-none bg-transparent cursor-pointer"
                            title="Xóa nhóm ảnh"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>

                        {/* List of Image URLs and live previews */}
                        <div className="space-y-2">
                          <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">Các ảnh trong bộ sưu tập (Paste URL ảnh)</span>
                          <div className="grid grid-cols-1 gap-2">
                            {group.images.map((img: string, imgIdx: number) => (
                              <div key={imgIdx} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-100">
                                {/* Small live Preview Thumbnail */}
                                <div className="h-10 w-10 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center border shrink-0">
                                  {img ? (
                                    <img src={img} alt="Thumbnail Preview" className="h-full w-full object-contain" />
                                  ) : (
                                    <ImageIcon className="size-4 text-slate-300" />
                                  )}
                                </div>
                                <div className="flex-grow flex gap-2">
                                  <input
                                    type="text"
                                    value={img}
                                    onChange={(e) => {
                                      updateImageUrlInGroup(gIdx, imgIdx, e.target.value);
                                      const key = `${gIdx}-${imgIdx}`;
                                      setPendingOptionFiles(prev => {
                                        const updated = { ...prev };
                                        delete updated[key];
                                        return updated;
                                      });
                                    }}
                                    placeholder="Nhập URL hình ảnh..."
                                    className="flex-grow px-2 py-1.5 bg-slate-50/50 rounded-lg text-xs focus:outline-none focus:bg-white border border-slate-200"
                                  />
                                  <label className="bg-indigo-50 hover:bg-indigo-100 text-indigo-750 font-bold text-[11px] px-2.5 py-1.5 rounded-lg border border-indigo-150 cursor-pointer inline-flex items-center gap-1 transition-all shrink-0">
                                    <ImageIcon className="size-3.5" />
                                    <span>Tải tệp</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          const key = `${gIdx}-${imgIdx}`;
                                          setPendingOptionFiles(prev => ({ ...prev, [key]: file }));
                                          const localUrl = URL.createObjectURL(file);
                                          updateImageUrlInGroup(gIdx, imgIdx, localUrl);
                                        }
                                      }}
                                    />
                                  </label>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => deleteImageUrlInGroup(gIdx, imgIdx)}
                                  className="p-1 text-slate-400 hover:text-rose-500 border-none bg-transparent cursor-pointer"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => addImageUrlToGroup(gIdx)}
                            className="text-[10px] font-extrabold text-indigo-500 hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-none mt-1"
                          >
                            <Plus className="size-3" />
                            <span>Thêm ảnh tiếp theo</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-4 border-t flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-extrabold rounded-xl transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer border-none"
                >
                  {editingProduct ? "Lưu thay đổi" : "Tạo sản phẩm"}
                </button>
              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}
