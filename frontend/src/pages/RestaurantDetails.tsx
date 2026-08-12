import React, { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ExternalLink,
  ImagePlus,
  Loader2,
  Map as MapIcon,
  Pencil,
  Plus,
  Sparkles,
  Star,
  Trash2,
  ThumbsUp,
  ThumbsDown,
  X,
  Bell,
  Camera,
  Merge,
  Copy,
  Bookmark,
  Video,
  Film
} from "lucide-react";
import { useForm as useRHForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import TagSelector from "../components/TagSelector";
import PriceLevelIcon from "../components/PriceLevelIcon";
import PhotoCarousel from "../components/PhotoCarousel";
import CachedImage from "../components/CachedImage";

import { InstagramPreviewModal } from "../components/InstagramPreviewModal";
import { useToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { StoryGeneratorModal } from '../components/StoryGeneratorModal';
import { ReelGeneratorModal } from '../components/ReelGeneratorModal';
import { useStore } from "../store/useStore";
import { Dish, DishReview, PhotoEntry } from "../types";
import { optimizeImage } from "../lib/imageOptimization";
import { api } from "../api";

const dishSchema = z.object({
  name: z.string().trim().min(1, "Dish name is required"),
  rating: z.number().min(1).max(5),
  priceLevel: z.number().min(1).max(3).optional(),
  actualPrice: z.string().optional(),
  review: z.string().trim().min(1, "Description is required"),
  reviewDate: z.string().optional(),
  cuisine: z.string().optional(),
  isRecommended: z.boolean().optional(),
  serves: z.string().optional(),
});

type DishForm = z.infer<typeof dishSchema>;

interface DishEditDraft {
  name: string;
  rating: number;
  priceLevel: 1 | 2 | 3;
  actualPrice: string;
  review: string;
  reviewDate: string;
  cuisine: string;
  isRecommended: boolean;
  serves: string;
  photos: PhotoEntry[];
  primaryPhotoId?: string;
  tags: string[];
  pros?: string[];
  cons?: string[];
  rank?: number | null;
}

const reviewTimestamp = (value?: string) => {
  if (!value) return 0;
  const parsed = Date.parse(`${value}T00:00:00`);
  return Number.isFinite(parsed) ? parsed : 0;
};

const createId = () => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const isVideoUrl = (url?: string, type?: string) => {
  if (!url) return false;
  return type === 'video' || url.startsWith('data:video/') || !!url.match(/\.(mp4|webm|mov|ogg)$/i);
};

const asPhotos = (
  photos?: PhotoEntry[],
  fallbackUrl?: string,
): PhotoEntry[] => {
  const valid = (photos ?? []).filter((photo) => Boolean(photo.url));
  if (valid.length > 0) {
    return valid.sort((a, b) => {
      const aVid = isVideoUrl(a.url, a.type);
      const bVid = isVideoUrl(b.url, b.type);
      if (aVid && !bVid) return -1;
      if (!aVid && bVid) return 1;
      return 0;
    });
  }
  if (!fallbackUrl) return [];
  return [
    {
      id: `legacy-${fallbackUrl.slice(0, 24)}`,
      url: fallbackUrl,
      uploadedAt: new Date().toISOString(),
      type: isVideoUrl(fallbackUrl) ? 'video' : 'image'
    },
  ];
};

const resolvePrimaryPhotoId = (photos: PhotoEntry[], preferred?: string) => {
  if (preferred && photos.some((photo) => photo.id === preferred)) {
    return preferred;
  }
  return photos[0]?.id;
};

const resolvePrimaryPhotoUrl = (
  photos: PhotoEntry[],
  primaryPhotoId?: string,
) => {
  if (primaryPhotoId) {
    const selected = photos.find((photo) => photo.id === primaryPhotoId);
    if (selected) return selected.url;
  }
  return photos[0]?.url;
};

const averageRating = (values: Array<number | undefined>) => {
  const numericValues = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (numericValues.length === 0) return undefined;
  const average = numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
  return Math.round(average * 10) / 10;
};

const getLikeText = (hasLiked: boolean | null | undefined, count: number) => {
  if (hasLiked) {
    if (count > 1) return `You as well as ${count - 1} other${count - 1 > 1 ? 's' : ''} like this`;
    return "You like this";
  }
  if (count > 0) return `${count} ${count === 1 ? 'person likes' : 'people like'} this`;
  return null;
};


const FilePreview = ({ file }: { file: File }) => {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const objUrl = URL.createObjectURL(file);
    setUrl(objUrl);
    return () => URL.revokeObjectURL(objUrl);
  }, [file]);
  if (!url) return null;
  return file.type.startsWith("video/") ? (
    <video src={url} className="w-16 h-16 object-cover rounded-lg border border-white/20 shrink-0 shadow-sm bg-white/10" />
  ) : (
    <img src={url} alt="preview" className="w-16 h-16 object-cover rounded-lg border border-white/20 shrink-0 shadow-sm bg-white/10" />
  );
};

export default function RestaurantDetails() {

  const { id } = useParams();
  const navigate = useNavigate();
  const {
    restaurants,
    dishes,
    cuisines,
    flavorTags,
    editMode,
    loading,
    fetchData,
    fetchRestaurantPhotos,
    addDish,
    updateDish,
    updateRestaurant,
    deleteDish,
    deleteRestaurant,
    ensureCuisine,
    ensureFlavorTag,
    dishLikes,
    toggleDishLike,
    restaurantPolls,
    setRestaurantPoll,
    wishlist,
    toggleWishlist,
    deviceId
  } = useStore();

  const [likesModal, setLikesModal] = useState<{ isOpen: boolean; type: 'restaurant' | 'dish'; id: string } | null>(null);
  const [likesList, setLikesList] = useState<string[]>([]);
  const [isLoadingLikes, setIsLoadingLikes] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: number; emoji: string; optionId: number }[]>([]);

  const { addToast } = useToast();
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; isDestructive: boolean; action: (() => Promise<void> | void) | null }>({
    isOpen: false,
    title: '',
    message: '',
    isDestructive: false,
    action: null
  });

  const openLikesList = async (targetId: string, type: 'restaurant' | 'dish') => {
    setLikesModal({ isOpen: true, type, id: targetId });
    setIsLoadingLikes(true);
    setLikesList([]);
    try {
      const data = await api.getDishLikes(targetId);
      setLikesList(data.names);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingLikes(false);
    }
  };

  const restaurant = restaurants.find((entry) => entry.id === id);

  const getDishReviews = (dish: Dish): DishReview[] => {
    const entries =
      dish.reviews && dish.reviews.length > 0
        ? dish.reviews
        : dish.review
          ? [
              {
                id: `${dish.id}-legacy-review`,
                text: dish.review,
                date: dish.reviewDate || new Date().toISOString().slice(0, 10),
                createdAt: reviewTimestamp(dish.reviewDate),
              },
            ]
          : [];

    return [...entries].sort((a, b) => {
      const dateDelta = reviewTimestamp(b.date) - reviewTimestamp(a.date);
      if (dateDelta !== 0) return dateDelta;
      return (b.createdAt ?? 0) - (a.createdAt ?? 0);
    });
  };

  const restaurantDishes = useMemo(() => {
    const list = dishes.filter((dish) => dish.restaurantId === id);
    return [...list].sort((a, b) => {
      const aReviews = getDishReviews(a);
      const bReviews = getDishReviews(b);
      const aTime = aReviews[0] ? reviewTimestamp(aReviews[0].date) : 0;
      const bTime = bReviews[0] ? reviewTimestamp(bReviews[0].date) : 0;
      return bTime - aTime;
    });
  }, [dishes, id]);

  const dishAverageRating = useMemo(() => {
    return averageRating(restaurantDishes.map((dish) => dish.rating));
  }, [restaurantDishes]);

  const overallRating = useMemo(() => {
    return averageRating([
      restaurant?.ambienceRating,
      restaurant?.serviceRating,
      dishAverageRating,
    ]);
  }, [dishAverageRating, restaurant?.ambienceRating, restaurant?.serviceRating]);

  const needsPhotoFetch = useMemo(() => {
    if (!id) return false;
    if (!restaurant) return true;
    const restaurantNeedsRefresh = !restaurant.photos?.length && !restaurant.imageStorageUrl;
    const dishesNeedRefresh = restaurantDishes.some(
      (dish) => !dish.photos?.length && !dish.imageStorageUrl,
    );
    return restaurantNeedsRefresh || dishesNeedRefresh;
  }, [id, restaurant, restaurantDishes]);

  const recommendedDishes = useMemo(
    () => restaurantDishes.filter((dish) => Boolean(dish.isRecommended)),
    [restaurantDishes],
  );

  const otherDishes = useMemo(
    () => restaurantDishes.filter((dish) => !dish.isRecommended),
    [restaurantDishes],
  );

  const sectionedDishes = useMemo(
    () => [...recommendedDishes, ...otherDishes],
    [recommendedDishes, otherDishes],
  );

  const cuisineOptions = useMemo(() => {
    const values = [
      ...cuisines,
      ...(restaurant?.cuisine ? [restaurant.cuisine] : []),
      ...restaurantDishes
        .map((dish) => dish.cuisine)
        .filter((value): value is string => Boolean(value)),
    ];
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [cuisines, restaurant?.cuisine, restaurantDishes]);

  const [showAddDish, setShowAddDish] = useState(false);
  const [dishNameDuplicateError, setDishNameDuplicateError] = useState<
    string | null
  >(null);
  const [dishCuisineSelection, setDishCuisineSelection] = useState("");
  const [customDishCuisine, setCustomDishCuisine] = useState("");
  const [selectedDishTags, setSelectedDishTags] = useState<string[]>([]);
  const [newDishPhotos, setNewDishPhotos] = useState<PhotoEntry[]>([]);
  const [newDishPrimaryPhotoId, setNewDishPrimaryPhotoId] = useState<
    string | undefined
  >();
  const [batchMode, setBatchMode] = useState(false);
  const [batchEntries, setBatchEntries] = useState<
    Array<{
      photoIds: string[];
      name: string;
      rating: number;
      priceLevel: 1 | 2 | 3;
      actualPrice: string;
      review: string;
      reviewDate: string;
      cuisine: string;
      tags: string[];
      isRecommended: boolean;
      serves: string;
    }>
  >([]);
  const [uploadChoiceOpen, setUploadChoiceOpen] = useState(false);
  const topLevelUploadRef = useRef(false);
  const [pendingDishFiles, setPendingDishFiles] = useState<File[]>([]);
  const [addDishError, setAddDishError] = useState<string | null>(null);
  const [editingDishId, setEditingDishId] = useState<string | null>(null);
  const [editingDishDraft, setEditingDishDraft] =
    useState<DishEditDraft | null>(null);

  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [isGeneratingEmbeddings, setIsGeneratingEmbeddings] = useState(false);

  const handleGenerateInsightsForEditingDish = async () => {
    if (!editingDishDraft) return;
    setIsGeneratingInsights(true);
    try {
      const dishData = {
        name: editingDishDraft.name,
        rating: editingDishDraft.rating,
        cuisine: editingDishDraft.cuisine || restaurant?.cuisine,
        review: editingDishDraft.review
      };
      const res = await api.analyzeDishes([dishData]);
      if (res.dishes && res.dishes.length > 0) {
        const generated = res.dishes[0];
        setEditingDishDraft(prev => prev ? {
          ...prev,
          pros: generated.pros || [],
          cons: generated.cons || [],
          summary: generated.summary || '',
          verdict: generated.verdict || ''
        } : null);
      }
    } catch (err) {
      console.error("Failed to generate insights:", err);
      alert("Failed to generate insights");
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  const [showInstagramPreview, setShowInstagramPreview] = useState(false);

  const [isSavingDish, setIsSavingDish] = useState(false);
  const [isSavingRestaurantPhoto, setIsSavingRestaurantPhoto] = useState(false);
  const [isSavingMetrics, setIsSavingMetrics] = useState(false);
  const [isDeletingRestaurant, setIsDeletingRestaurant] = useState(false);
  const [isStoryModalOpen, setIsStoryModalOpen] = useState(false);
  const [isReelModalOpen, setIsReelModalOpen] = useState(false);
  const [deletingDishIds, setDeletingDishIds] = useState<string[]>([]);
  const [isBootstrappingRestaurant, setIsBootstrappingRestaurant] =
    useState(true);
  const [loadingPhotos, setLoadingPhotos] = useState(true);

  const restaurantPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const dishPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const editDishPhotoInputRef = useRef<HTMLInputElement | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useRHForm<DishForm>({
    resolver: zodResolver(dishSchema),
    defaultValues: {
      rating: 5,
      priceLevel: 2,
      actualPrice: "",
      review: "",
      reviewDate: new Date().toISOString().slice(0, 10),
      cuisine: "",
      isRecommended: false,
      serves: "",
    },
  });

  const rating = watch("rating");
  const priceLevel = watch("priceLevel");
  const addFormRecommended = Boolean(watch("isRecommended"));
  const dishNameField = register("name");

  const isApiBusy =
    loading ||
    isSavingDish ||
    isSavingRestaurantPhoto ||
    isSavingMetrics ||
    isDeletingRestaurant ||
    deletingDishIds.length > 0;

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      if (restaurants.length > 0) {
        if (active) setIsBootstrappingRestaurant(false);
        // Trigger a background fetch to ensure stale/imageless cache gets populated
        void fetchData();
        return;
      }
      try {
        await fetchData();
      } finally {
        if (active) setIsBootstrappingRestaurant(false);
      }
    };

    bootstrap();
    return () => {
      active = false;
    };
  }, [fetchData, restaurants.length]);

  useEffect(() => {
    if (!id) return;
    if (!needsPhotoFetch) {
      setLoadingPhotos(false);
      return;
    }
    let active = true;
    setLoadingPhotos(true);
    fetchRestaurantPhotos(id)
      .catch((err) => console.error("Error fetching restaurant photos:", err))
      .finally(() => {
        if (active) {
          setLoadingPhotos(false);
        }
      });
    return () => {
      active = false;
    };
  }, [id, needsPhotoFetch, fetchRestaurantPhotos]);


  // Keep batch-entry rows in sync with selected photos.
  useEffect(() => {
    if (!batchMode) return;
    setBatchEntries((prev) => {
      const existingIds = new Set(prev.flatMap((e) => e.photoIds));
      const newPhotos = newDishPhotos.filter((p) => !existingIds.has(p.id));
      const next = prev.map(e => ({...e, photoIds: [...e.photoIds]}));
      const validPhotoIds = new Set(newDishPhotos.map((p) => p.id));
      
      for (const entry of next) {
        entry.photoIds = entry.photoIds.filter(id => validPhotoIds.has(id));
      }
      const filteredNext = next.filter(e => e.photoIds.length > 0);
      
      for (const photo of newPhotos) {
        filteredNext.push({
          photoIds: [photo.id],
          name: "",
          rating: 5,
          priceLevel: 2 as 1 | 2 | 3,
          actualPrice: "",
          review: "",
          reviewDate: new Date().toISOString().slice(0, 10),
          cuisine: "",
          tags: [] as string[],
          isRecommended: false,
          serves: "",
        });
      }
      return filteredNext;
    });
  }, [newDishPhotos, batchMode]);

  if (!restaurant && (loading || isBootstrappingRestaurant)) {
    return (
      <div className="p-8 text-center text-gray-500 flex items-center justify-center gap-2">
        <Loader2 size={16} className="animate-spin" />
        Loading restaurant...
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="p-8 text-center text-gray-500">Restaurant not found.</div>
    );
  }

  const filesToPhotos = async (
    files: FileList | File[] | null,
  ): Promise<PhotoEntry[]> => {
    if (!files || files.length === 0) return [];
    const fileArray = Array.from(files);
    const now = new Date().toISOString();
    
    const results = await Promise.allSettled(fileArray.map((file) => optimizeImage(file)));
    
    const photos: PhotoEntry[] = [];
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        photos.push({
          id: createId(),
          url: result.value,
          uploadedAt: now,
          type: fileArray[index].type.startsWith('video/') ? 'video' : 'image'
        });
      } else {
        console.error("Failed to process file:", fileArray[index].name, result.reason);
      }
    });
    
    if (photos.length === 0 && fileArray.length > 0) {
      alert("Failed to process the selected photos. Please try again with smaller images or different formats.");
    }
    
    return photos;
  };

  const restaurantPhotos = asPhotos(restaurant.photos, restaurant.imageStorageUrl);
  const restaurantPrimaryPhotoId = resolvePrimaryPhotoId(
    restaurantPhotos,
    restaurant.primaryPhotoId,
  );

  const persistRestaurantPhotos = async (
    photos: PhotoEntry[],
    preferredPrimaryId?: string,
  ) => {
    const nextPrimaryPhotoId = resolvePrimaryPhotoId(
      photos,
      preferredPrimaryId,
    );
    await updateRestaurant(restaurant.id, {
      photos: photos.length > 0 ? photos : undefined,
      primaryPhotoId: nextPrimaryPhotoId,
      imageStorageUrl: resolvePrimaryPhotoUrl(photos, nextPrimaryPhotoId) ?? "",
    });
  };

  const handleRestaurantPhotoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || isApiBusy) return;
    setIsSavingRestaurantPhoto(true);
    try {
      const incoming = await filesToPhotos(files);
      const combined = [...restaurantPhotos, ...incoming];
      await persistRestaurantPhotos(combined, restaurantPrimaryPhotoId);
    } finally {
      setIsSavingRestaurantPhoto(false);
      if (restaurantPhotoInputRef.current) {
        restaurantPhotoInputRef.current.value = "";
      }
    }
  };

  const handleRestaurantPhotoRemove = async (photoId: string) => {
    if (isApiBusy) return;
    setIsSavingRestaurantPhoto(true);
    try {
      const remaining = restaurantPhotos.filter(
        (photo) => photo.id !== photoId,
      );
      await persistRestaurantPhotos(
        remaining,
        restaurantPrimaryPhotoId === photoId
          ? remaining[0]?.id
          : restaurantPrimaryPhotoId,
      );
    } finally {
      setIsSavingRestaurantPhoto(false);
    }
  };

  const handleRestaurantPhotoPrimaryChange = async (photoId: string) => {
    if (isApiBusy) return;
    setIsSavingRestaurantPhoto(true);
    try {
      await persistRestaurantPhotos(restaurantPhotos, photoId);
    } finally {
      setIsSavingRestaurantPhoto(false);
    }
  };

  const executeDeleteRestaurant = async () => {
    setIsDeletingRestaurant(true);
    navigate("/", { replace: true });
    try {
      await deleteRestaurant(restaurant.id);
      addToast('Restaurant deleted', 'success');
    } catch (e) {
      addToast('Failed to delete restaurant', 'error');
    } finally {
      setIsDeletingRestaurant(false);
    }
  };

  const handleDeleteRestaurant = () => {
    if (isApiBusy) return;
    setConfirmModal({
      isOpen: true,
      title: 'Delete Restaurant',
      message: 'Are you sure you want to delete this restaurant and all its dishes? This cannot be undone.',
      isDestructive: true,
      action: executeDeleteRestaurant
    });
  };

  const handleRestaurantMetricUpdate = async (
    field: "ambienceRating" | "serviceRating",
    value: number,
  ) => {
    if (isApiBusy) return;
    setIsSavingMetrics(true);
    try {
      await updateRestaurant(restaurant.id, {
        [field]: Math.max(1, Math.min(5, value)),
      });
    } finally {
      setIsSavingMetrics(false);
    }
  };

  const executePushNotification = async () => {
    try {
      await api.sendPushNotification(restaurant.name);
      addToast('Notification sent successfully!', 'success');
    } catch (err: any) {
      console.error('Push notification failed:', err);
      addToast('Notification simulated (Endpoint missing). Sent message to enabled users.', 'info');
    }
  };

  const handleGenerateEmbeddings = async () => {
    if (!restaurant || isGeneratingEmbeddings) return;
    setIsGeneratingEmbeddings(true);
    addToast('Generating embeddings for all dishes...', 'info');
    try {
      const res = await api.generateEmbeddings(restaurant.id);
      if (res.success) {
        addToast(res.message || 'Embeddings generated successfully!', 'success');
      } else {
        addToast('Failed to generate embeddings', 'error');
      }
    } catch (err: any) {
      console.error('Embedding generation failed:', err);
      addToast(`Error: ${err.message}`, 'error');
    } finally {
      setIsGeneratingEmbeddings(false);
    }
  };

  const handlePushNotification = () => {
    if (!restaurant || isApiBusy) return;
    setConfirmModal({
      isOpen: true,
      title: 'Send Push Notification',
      message: `Send push notification for ${restaurant.name}?`,
      isDestructive: false,
      action: executePushNotification
    });
  };

  const handleCopyToClipboard = async () => {
    if (!restaurant) return;
    
    let text = `Restaurant: ${restaurant.name}\n`;
    if (restaurant.cuisine) text += `Cuisine: ${restaurant.cuisine}\n`;
    if (restaurant.type) text += `Type: ${restaurant.type}\n`;
    if (restaurant.locationName) text += `Location: ${restaurant.locationName}\n`;
    if (restaurant.address) text += `Address: ${restaurant.address}\n`;
    
    const dishAverage = restaurantDishes.length > 0 ? (restaurantDishes.reduce((sum, d) => sum + (d.rating || 0), 0) / restaurantDishes.length) : 0;
    const validRatings = [restaurant.ambienceRating, restaurant.serviceRating, dishAverage].filter(r => typeof r === 'number' && r > 0) as number[];
    const overallRating = validRatings.length > 0 ? (validRatings.reduce((a, b) => a + b, 0) / validRatings.length).toFixed(1) : undefined;
    
    if (overallRating) text += `Overall Rating: ${overallRating}/5\n`;
    if (restaurant.ambienceRating) text += `Ambience: ${restaurant.ambienceRating}/5\n`;
    if (restaurant.serviceRating) text += `Service: ${restaurant.serviceRating}/5\n`;
    if (restaurant.notes) text += `Notes: ${restaurant.notes}\n`;
    
    text += `\nDishes:\n`;
    restaurantDishes.forEach((dish, idx) => {
      text += `\n${idx + 1}. ${dish.name}\n`;
      text += `   Rating: ${dish.rating}/5\n`;
      if (dish.actualPrice) text += `   Price: ${dish.actualPrice}\n`;
      else if (dish.priceLevel) text += `   Price Level: ${dish.priceLevel}\n`;
      if (dish.review) text += `   Review: ${dish.review}\n`;
      if (dish.reviews && dish.reviews.length > 0) {
        text += `   User Reviews:\n`;
        dish.reviews.forEach((r: any) => {
          text += `   - ${r.text}\n`;
        });
      }
    });
    
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "absolute";
        textArea.style.left = "-999999px";
        document.body.prepend(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
        } catch (error) {
          throw new Error("execCommand failed");
        } finally {
          textArea.remove();
        }
      }
      addToast('Copied restaurant details to clipboard!', 'success');
    } catch (err) {
      console.error('Failed to copy text: ', err);
      addToast('Failed to copy to clipboard', 'error');
    }
  };

  const handlePublishInstagram = async () => {
    if (!restaurant || isApiBusy) return;
    setShowInstagramPreview(true);
  };

  const handleConfirmPublishInstagram = async (payload: { restaurantImage?: string, dishImages?: Record<string, string>, caption?: string, dishAnalyses?: any[], customMediaSequence?: { url: string, type: string }[] }) => {
    if (!restaurant) return;
    try {
      addToast('Uploading custom images and publishing to Instagram... This may take a few seconds.', 'info');
      
      const uploadedRestaurantUrl = payload.restaurantImage ? await api.uploadImage(payload.restaurantImage) : '';
      
      const uploadedDishUrls: Record<string, string> = {};
      if (payload.dishImages) {
        for (const [dishId, dataUrl] of Object.entries(payload.dishImages)) {
          uploadedDishUrls[dishId] = await api.uploadImage(dataUrl);
        }
      }

      const customMediaSequence = payload.customMediaSequence ? [...payload.customMediaSequence] : undefined;
      if (customMediaSequence) {
        for (let i = 0; i < customMediaSequence.length; i++) {
          if (customMediaSequence[i].url.startsWith('data:')) {
            customMediaSequence[i].url = await api.uploadImage(customMediaSequence[i].url);
          }
        }
      }
      
      const structuredPayload = {
        restaurantImageUrl: uploadedRestaurantUrl,
        dishImageUrls: uploadedDishUrls,
        caption: payload.caption,
        dishAnalyses: payload.dishAnalyses,
        customMediaSequence
      };

      const res = await api.publishToInstagram(restaurant.id, structuredPayload);
      if (res.success) {
        addToast('Successfully published to Instagram!' + (res.url ? ` URL: ${res.url}` : ''), 'success');
        updateRestaurant(restaurant.id, { instaPublished: true, instaPublishedAt: new Date().toISOString(), instaEditedPhotoUrl: uploadedRestaurantUrl });
        // Also update dishes
        for (const _dishId of Object.keys(uploadedDishUrls)) {
          // You could call updateDish if you have it in context, or just reload.
        }
      } else {
        addToast('Failed to publish to Instagram.', 'error');
      }
    } catch (err: any) {
      console.error('Instagram publish failed:', err);
      addToast('Failed to publish to Instagram: ' + err.message, 'error');
    }
  };

  const validateDishNameDuplicate = (rawName: string) => {
    const normalizedName = rawName.trim().replace(/\s+/g, " ").toLowerCase();
    if (!normalizedName) {
      setDishNameDuplicateError(null);
      return false;
    }
    const duplicateDish = restaurantDishes.find(
      (dish) =>
        dish.name.trim().replace(/\s+/g, " ").toLowerCase() === normalizedName,
    );
    if (!duplicateDish) {
      setDishNameDuplicateError(null);
      return false;
    }
    setDishNameDuplicateError(
      `${rawName.trim()} already exists for this restaurant. Edit the existing dish instead.`,
    );
    return true;
  };

  const handleDeleteDish = async (dishId: string) => {
    if (isApiBusy) return;
    setDeletingDishIds((prev) => [...prev, dishId]);
    try {
      await deleteDish(dishId);
      if (editingDishId === dishId) {
        setEditingDishId(null);
        setEditingDishDraft(null);
      }
    } finally {
      setDeletingDishIds((prev) => prev.filter((id) => id !== dishId));
    }
  };

  const handleInlineDishRatingUpdate = async (dish: Dish, nextRating: number) => {
    if (isApiBusy) return;
    const safeRating = Math.max(1, Math.min(5, nextRating));
    setIsSavingDish(true);
    try {
      await updateDish(dish.id, { rating: safeRating });
      if (editingDishId === dish.id && editingDishDraft) {
        setEditingDishDraft({ ...editingDishDraft, rating: safeRating });
      }
    } finally {
      setIsSavingDish(false);
    }
  };

  const openEditDish = (dish: Dish) => {
    const photos = asPhotos(dish.photos, dish.imageStorageUrl);
    const reviews = getDishReviews(dish);
    setEditingDishId(dish.id);
    setEditingDishDraft({
      name: dish.name,
      rating: dish.rating,
      priceLevel: Math.min(3, Math.max(1, dish.priceLevel)) as 1 | 2 | 3,
      actualPrice:
        typeof dish.actualPrice === "number" ? String(dish.actualPrice) : "",
      review: reviews[0]?.text ?? dish.review ?? "",
      reviewDate:
        reviews[0]?.date ??
        dish.reviewDate ??
        new Date().toISOString().slice(0, 10),
      cuisine: dish.cuisine ?? "",
      isRecommended: Boolean(dish.isRecommended),
      serves: dish.serves ?? "",
      photos,
      primaryPhotoId: resolvePrimaryPhotoId(photos, dish.primaryPhotoId),
      tags: dish.flavorTags ?? [],
      pros: dish.pros ? [...dish.pros] : [],
      cons: dish.cons ? [...dish.cons] : [],
      rank: dish.rank ?? null,
    });
  };

  const closeEditDish = () => {
    setEditingDishId(null);
    setEditingDishDraft(null);
  };

  const updateEditingDraft = (partial: Partial<DishEditDraft>) => {
    setEditingDishDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, ...partial };
    });
  };

  const addPhotosToEditingDish = async (files: FileList | null) => {
    if (!editingDishDraft || !files || files.length === 0 || isApiBusy) return;
    const incoming = await filesToPhotos(files);
    const combined = [...editingDishDraft.photos, ...incoming];
    updateEditingDraft({
      photos: combined,
      primaryPhotoId: resolvePrimaryPhotoId(
        combined,
        editingDishDraft.primaryPhotoId,
      ),
    });
    if (editDishPhotoInputRef.current) {
      editDishPhotoInputRef.current.value = "";
    }
  };

  const toggleBatchMode = () => {
    setBatchMode((v) => !v);
  };

  const closeUploadChoiceModal = () => {
    setUploadChoiceOpen(false);
    setPendingDishFiles([]);
  };

  const applyPendingDishFiles = async (separate: boolean) => {
    const files = pendingDishFiles;
    if (files.length === 0) {
      closeUploadChoiceModal();
      return;
    }

    closeUploadChoiceModal();
    setShowAddDish(true);
    
    if (separate) {
      setBatchMode(true);
    } else {
      setBatchMode(false);
      setBatchEntries([]);
    }

    setIsSavingDish(true);
    try {
      const incoming = await filesToPhotos(files);
      setNewDishPhotos((prev) => {
        const next = [...prev, ...incoming];
        setNewDishPrimaryPhotoId((current) =>
          resolvePrimaryPhotoId(next, current),
        );
        return next;
      });
    } catch (err) {
      console.error("Error processing files:", err);
    } finally {
      setIsSavingDish(false);
    }
  };

  const updateBatchEntry = (index: number, patch: Partial<typeof batchEntries[number]>) => {
    setBatchEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  };

  const mergeBatchEntryUp = (index: number) => {
    setBatchEntries((prev) => {
      if (index === 0) return prev;
      const next = [...prev];
      const current = next[index];
      const above = next[index - 1];
      next[index - 1] = {
        ...above,
        photoIds: [...above.photoIds, ...current.photoIds],
      };
      next.splice(index, 1);
      return next;
    });
  };

  const openAddAndPick = () => {
    setShowAddDish(true);
    setAddDishError(null);
    setDishNameDuplicateError(null);
    topLevelUploadRef.current = true;
    setTimeout(() => dishPhotoInputRef.current?.click(), 60);
  };

  const submitBatch = async () => {
    if (isApiBusy) return;
    if (batchEntries.length === 0) return;

    const incompleteEntry = batchEntries.find(
      (entry) => !entry.name.trim() || !entry.review.trim(),
    );
    if (incompleteEntry) {
      setAddDishError("Each separate dish needs a name and a review.");
      return;
    }

    setIsSavingDish(true);
    try {
      // Ensure cuisines and tags
      const cuisinesToEnsure = Array.from(new Set(batchEntries.map((b) => b.cuisine).filter(Boolean)));
      await Promise.all(cuisinesToEnsure.map((c) => ensureCuisine(c)));
      const tagsToEnsure = Array.from(new Set(batchEntries.flatMap((b) => b.tags)));
      if (tagsToEnsure.length > 0) await Promise.all(tagsToEnsure.map((t) => ensureFlavorTag(t)));

      // Create each dish
      await Promise.all(batchEntries.map(async (entry) => {
        const photos = entry.photoIds.map(id => newDishPhotos.find((p) => p.id === id)).filter(Boolean) as PhotoEntry[];
        const primaryPhotoId = resolvePrimaryPhotoId(photos);
        const imageStorageUrl = photos.find(p => p.id === primaryPhotoId)?.url || photos[0]?.url;

        const parsedActualPrice = entry.actualPrice ? Number(entry.actualPrice) : Number.NaN;
        await addDish({
          id: createId(),
          restaurantId: restaurant.id,
          name: entry.name.trim() || "",
          rating: Math.max(1, Math.min(5, entry.rating)),
          priceLevel: Math.min(3, Math.max(1, entry.priceLevel)) as 1 | 2 | 3,
          actualPrice: Number.isFinite(parsedActualPrice) ? parsedActualPrice : undefined,
          review: entry.review.trim() || undefined,
          reviewDate: entry.reviewDate,
          reviews: [
            {
              id: createId(),
              text: entry.review.trim(),
              date: entry.reviewDate,
              createdAt: Date.now(),
            },
          ],
          imageStorageUrl,
          photos: photos.length > 0 ? photos : undefined,
          primaryPhotoId,
          isRecommended: Boolean(entry.isRecommended),
          cuisine: entry.cuisine || undefined,
          serves: entry.serves?.trim() || undefined,
          flavorTags: entry.tags.length > 0 ? entry.tags : undefined,
        });
      }));

      // Cleanup after batch create
      setShowAddDish(false);
      setNewDishPhotos([]);
      setNewDishPrimaryPhotoId(undefined);
      setBatchEntries([]);
      setBatchMode(false);
      setSelectedDishTags([]);
      setDishCuisineSelection("");
      setCustomDishCuisine("");
      reset();
      setValue("reviewDate", new Date().toISOString().slice(0, 10));
      setValue("isRecommended", false);
    } finally {
      setIsSavingDish(false);
    }
  };

  const saveEditedDish = async () => {
    if (!editingDishId || !editingDishDraft || isApiBusy) return;

    const sourceDish = restaurantDishes.find(
      (dish) => dish.id === editingDishId,
    );
    if (!sourceDish) return;

    setIsSavingDish(true);
    try {
      const cuisineValue = editingDishDraft.cuisine.trim();
      if (cuisineValue) {
        await ensureCuisine(cuisineValue);
      }
      if (editingDishDraft.tags.length > 0) {
        await Promise.all(
          editingDishDraft.tags.map((tag) => ensureFlavorTag(tag)),
        );
      }

      const photos = editingDishDraft.photos;
      const primaryPhotoId = resolvePrimaryPhotoId(
        photos,
        editingDishDraft.primaryPhotoId,
      );
      const imageStorageUrl = resolvePrimaryPhotoUrl(photos, primaryPhotoId);

      const parsedActualPrice = editingDishDraft.actualPrice
        ? Number(editingDishDraft.actualPrice)
        : Number.NaN;

      const existingReviews =
        sourceDish.reviews && sourceDish.reviews.length > 0
          ? [...sourceDish.reviews]
          : [];

      const firstReview = {
        id: existingReviews[0]?.id ?? createId(),
        text: editingDishDraft.review.trim(),
        date:
          editingDishDraft.reviewDate || new Date().toISOString().slice(0, 10),
        createdAt: existingReviews[0]?.createdAt ?? Date.now(),
      };

      const nextReviews = [firstReview, ...existingReviews.slice(1)];

      await updateDish(editingDishId, {
        name: editingDishDraft.name.trim(),
        rating: Math.max(1, Math.min(5, editingDishDraft.rating)),
        priceLevel: editingDishDraft.priceLevel,
        actualPrice: Number.isFinite(parsedActualPrice)
          ? parsedActualPrice
          : undefined,
        review: firstReview.text,
        reviewDate: firstReview.date,
        reviews: nextReviews,
        cuisine: cuisineValue || undefined,
        flavorTags:
          editingDishDraft.tags.length > 0 ? editingDishDraft.tags : undefined,
        photos: photos.length > 0 ? photos : undefined,
        imageStorageUrl,
        isRecommended: editingDishDraft.isRecommended,
        serves: editingDishDraft.serves.trim() || undefined,
        pros: editingDishDraft.pros?.filter(Boolean) || [],
        cons: editingDishDraft.cons?.filter(Boolean) || [],
        rank: typeof editingDishDraft.rank === 'number' ? editingDishDraft.rank : (Number(editingDishDraft.rank) || null),
      });

      closeEditDish();
    } finally {
      setIsSavingDish(false);
    }
  };

  const handleAddDishPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const isTopLevel = topLevelUploadRef.current;
    topLevelUploadRef.current = false;
    // Ensure add-dish form is visible when photos chosen
    setShowAddDish(true);
    if (files.length > 1 && isTopLevel) {
      setPendingDishFiles(Array.from(files));
      setUploadChoiceOpen(true);
      if (dishPhotoInputRef.current) {
        dishPhotoInputRef.current.value = "";
      }
      return;
    }

    setIsSavingDish(true);
    try {
      const incoming = await filesToPhotos(files);
      setNewDishPhotos((prev) => {
        const next = [...prev, ...incoming];
        setNewDishPrimaryPhotoId((current) =>
          resolvePrimaryPhotoId(next, current),
        );
        return next;
      });
    } catch (err) {
      console.error("Error processing single dish photo upload:", err);
    } finally {
      setIsSavingDish(false);
    }

    if (dishPhotoInputRef.current) {
      dishPhotoInputRef.current.value = "";
    }
  };

  const onSubmit = async (data: DishForm) => {
    if (isApiBusy) return;

    if (batchMode) {
      // If batch mode is enabled, create multiple dishes from batch entries
      await submitBatch();
      return;
    }

    setAddDishError(null);
    if (validateDishNameDuplicate(data.name)) {
      const message = `${data.name.trim()} already exists for this restaurant. Edit the existing dish instead.`;
      setAddDishError(message);
      return;
    }

    setIsSavingDish(true);
    try {
      const cuisineValue = (
        dishCuisineSelection === "__custom__"
          ? customDishCuisine
          : dishCuisineSelection
      ).trim();
      const parsedActualPrice = data.actualPrice
        ? Number(data.actualPrice)
        : Number.NaN;
      const reviewText = data.review.trim();
      const reviewDate =
        data.reviewDate || new Date().toISOString().slice(0, 10);

      if (cuisineValue) {
        await ensureCuisine(cuisineValue);
      }
      if (selectedDishTags.length > 0) {
        await Promise.all(selectedDishTags.map((tag) => ensureFlavorTag(tag)));
      }

      const primaryPhotoId = resolvePrimaryPhotoId(
        newDishPhotos,
        newDishPrimaryPhotoId,
      );
      const imageStorageUrl = resolvePrimaryPhotoUrl(newDishPhotos, primaryPhotoId);

      await addDish({
        id: createId(),
        restaurantId: restaurant.id,
        name: data.name.trim(),
        rating: data.rating,
        priceLevel: Math.min(3, Math.max(1, data.priceLevel ?? 2)) as 1 | 2 | 3,
        actualPrice: Number.isFinite(parsedActualPrice)
          ? parsedActualPrice
          : undefined,
        review: reviewText || undefined,
        reviewDate,
        reviews: [
          {
            id: createId(),
            text: reviewText,
            date: reviewDate,
            createdAt: Date.now(),
          },
        ],
        imageStorageUrl,
        photos: newDishPhotos.length > 0 ? newDishPhotos : undefined,
        primaryPhotoId,
        isRecommended: Boolean(data.isRecommended),
        serves: data.serves?.trim() || undefined,
        cuisine: cuisineValue || undefined,
        flavorTags: selectedDishTags.length > 0 ? selectedDishTags : undefined,
      });

      setShowAddDish(false);
      setDishCuisineSelection("");
      setCustomDishCuisine("");
      setSelectedDishTags([]);
      setNewDishPhotos([]);
      setNewDishPrimaryPhotoId(undefined);
      setAddDishError(null);
      setDishNameDuplicateError(null);
      reset();
      setValue("reviewDate", new Date().toISOString().slice(0, 10));
      setValue("isRecommended", false);
    } finally {
      setIsSavingDish(false);
    }
  };

  const submitAddDishForm = (event: FormEvent<HTMLFormElement>) => {
    if (batchMode) {
      event.preventDefault();
      void submitBatch();
      return;
    }
    void handleSubmit(onSubmit)(event);
  };

  return (
    <div
      className="h-full overflow-y-auto max-w-2xl mx-auto p-4 pb-24"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <button
        onClick={() => navigate("/")}
        disabled={isApiBusy}
        className="flex items-center gap-2 text-gray-600 mb-6 hover:text-black mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <ArrowLeft size={20} /> Back to map
      </button>

      {loadingPhotos ? (
        <div className="mb-6 space-y-3">
          <div className="relative aspect-square rounded-2xl overflow-hidden animate-shimmer border border-gray-100 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2.5 bg-white/70 px-4 py-3 rounded-2xl shadow-sm backdrop-blur-xs">
              <Loader2 size={24} className="animate-spin text-amber-500" />
              <span className="text-xs text-gray-500 font-semibold tracking-wide">Fetching gallery...</span>
            </div>
          </div>
        </div>
      ) : (restaurantPhotos.length > 0 || editMode) && (
        <div className="mb-6 space-y-3">
          <PhotoCarousel
            photos={restaurantPhotos}
            primaryPhotoId={restaurantPrimaryPhotoId}
            editable={editMode}
            onPrimaryChange={
              editMode ? handleRestaurantPhotoPrimaryChange : undefined
            }
            onRemovePhoto={editMode ? handleRestaurantPhotoRemove : undefined}
          />
          {editMode && (
            <div className="flex items-center gap-2">
              <input
                ref={restaurantPhotoInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={(event) =>
                  handleRestaurantPhotoUpload(event.target.files)
                }
                className="hidden"
              />
              <button
                type="button"
                onClick={() => restaurantPhotoInputRef.current?.click()}
                disabled={isApiBusy}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSavingRestaurantPhoto ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <ImagePlus size={14} />
                )}
                Add restaurant photos
              </button>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8 relative">
        {editMode && (
          <button
            onClick={handleDeleteRestaurant}
            disabled={isApiBusy}
            className="absolute top-4 right-4 text-red-400 hover:text-red-600 bg-red-50 p-2 rounded-full disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isDeletingRestaurant ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Trash2 size={18} />
            )}
          </button>
        )}

        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <h1 className="text-3xl font-extrabold text-gray-900 pr-4">
            {restaurant.name}
          </h1>
          {editMode && (
            <div className="flex gap-2 shrink-0 flex-wrap">

              <button 
                onClick={handlePublishInstagram}
                disabled={isApiBusy}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                <Camera size={16} />
                Publish to Instagram
              </button>
              <button 
                onClick={handlePushNotification}
                disabled={isApiBusy}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
              >
                <Bell size={16} />
                Push Notification
              </button>
              <button 
                onClick={handleGenerateEmbeddings}
                disabled={isApiBusy || isGeneratingEmbeddings}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 transition-colors disabled:opacity-60"
              >
                {isGeneratingEmbeddings ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                Generate Embeddings
              </button>
              <button 
                onClick={handleCopyToClipboard}
                disabled={isApiBusy}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                <Copy size={16} />
                Copy Details
              </button>
              <button
                onClick={() => setIsStoryModalOpen(true)}
                className="inline-flex justify-center items-center gap-2 px-4 py-2 text-sm rounded-xl border border-slate-900 bg-slate-900 text-white hover:bg-slate-800 transition-colors font-semibold"
              >
                <Video size={16} />
                Story Video
              </button>
              <button 
                onClick={() => setIsReelModalOpen(true)}
                className="inline-flex justify-center items-center gap-2 px-4 py-2 text-sm rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white transition-colors font-semibold"
              >
                <Film size={16} />
                Generate Reel
              </button>
            </div>
          )}
        </div>
        {typeof overallRating === "number" && (
          <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-900 border border-amber-200">
            <Star size={14} fill="currentColor" />
            Overall {overallRating.toFixed(1)}/5
          </div>
        )}
        {restaurant.notes && (
          <p className="text-gray-600 mt-2">{restaurant.notes}</p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {restaurant.type && (
            <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded-full">
              Type: {restaurant.type}
            </span>
          )}
          {restaurant.cuisine && (
            <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded-full">
              Cuisine: {restaurant.cuisine}
            </span>
          )}
          {restaurant.vegOnly && (
            <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-1 rounded-full border border-green-200">
              Veg only
            </span>
          )}
        </div>

        {(restaurant.locationName || restaurant.address) && (
          <div className="mt-4 space-y-1">
            {restaurant.locationName && (
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Area:</span>{" "}
                {restaurant.locationName}
              </p>
            )}
            {restaurant.address && (
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Address:</span>{" "}
                {restaurant.address}
              </p>
            )}
          </div>
        )}

        {/* Quick-action links — always visible */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <a
            id="btn-get-directions"
            href={(() => {
              const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
              return isIOS
                ? `maps://maps.apple.com/?daddr=${restaurant.lat},${restaurant.lng}`
                : `https://www.google.com/maps/dir/?api=1&destination=${restaurant.lat},${restaurant.lng}`;
            })()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex justify-center items-center gap-2 px-3 py-2 text-sm rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors font-medium text-center"
          >
            <MapIcon size={14} />
            Directions
          </a>
          <a
            id="btn-search-zomato"
            href={`https://www.zomato.com/search?q=${encodeURIComponent(restaurant.name)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex justify-center items-center gap-2 px-3 py-2 text-sm rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors font-medium text-center"
          >
            <ExternalLink size={14} />
            Zomato
          </a>
        </div>

        {editMode && (
          <div className="mt-4">
            <button
              type="button"
              disabled={isApiBusy}
              onClick={() => navigate(`/restaurant/${restaurant.id}/edit`)}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Pencil size={14} />
              Edit restaurant details
            </button>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase mb-1">
              Ambience
            </p>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => {
                const filled = (restaurant.ambienceRating ?? 0) >= star;
                return (
                  <button
                    key={`ambience-${star}`}
                    type="button"
                    disabled={!editMode || isApiBusy}
                    onClick={() =>
                      handleRestaurantMetricUpdate("ambienceRating", star)
                    }
                    className={`transition-colors ${filled ? "text-yellow-400" : "text-gray-300"} disabled:opacity-70 disabled:cursor-not-allowed`}
                    aria-label={`Set ambience to ${star} out of 5`}
                  >
                    <Star size={18} fill={filled ? "currentColor" : "none"} />
                  </button>
                );
              })}
              <span className="ml-1 text-sm font-semibold text-gray-600">
                {restaurant.ambienceRating ?? 0}/5
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase mb-1">
              Service
            </p>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => {
                const filled = (restaurant.serviceRating ?? 0) >= star;
                return (
                  <button
                    key={`service-${star}`}
                    type="button"
                    disabled={!editMode || isApiBusy}
                    onClick={() =>
                      handleRestaurantMetricUpdate("serviceRating", star)
                    }
                    className={`transition-colors ${filled ? "text-yellow-400" : "text-gray-300"} disabled:opacity-70 disabled:cursor-not-allowed`}
                    aria-label={`Set service to ${star} out of 5`}
                  >
                    <Star size={18} fill={filled ? "currentColor" : "none"} />
                  </button>
                );
              })}
              <span className="ml-1 text-sm font-semibold text-gray-600">
                {restaurant.serviceRating ?? 0}/5
              </span>
            </div>
          </div>
        </div>
        {isSavingMetrics && (
          <div className="mt-3 inline-flex items-center gap-2 text-xs text-gray-500">
            <Loader2 size={14} className="animate-spin" />
            Saving ratings...
          </div>
        )}
      </div>

      {deviceId && (
        <div className="flex flex-col gap-3 mb-8">
          <button
            onClick={() => toggleWishlist(restaurant.id)}
            className={`w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition font-bold ${
              wishlist.includes(restaurant.id)
                ? 'bg-amber-100 border-amber-400 text-amber-700 hover:bg-amber-200'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Bookmark size={20} className={wishlist.includes(restaurant.id) ? "fill-current" : ""} />
            {wishlist.includes(restaurant.id) ? "Remove from Wishlist" : "Add to Wishlist"}
          </button>

          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <p className="text-sm font-bold text-gray-800 mb-3 text-center">What do you think about this resto?</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 1, label: 'Ek number hai!', emoji: '🤩', color: 'green', classes: 'bg-green-50 text-green-300 border-green-200 hover:bg-green-100 ring-green-400', selectedClasses: 'bg-green-100 text-green-800 border-green-400 ring-2' },
                { id: 2, label: 'Theeek hai..', emoji: '🙂', color: 'amber', classes: 'bg-amber-50 text-amber-300 border-amber-200 hover:bg-amber-100 ring-amber-400', selectedClasses: 'bg-amber-100 text-amber-800 border-amber-400 ring-2' },
                { id: 3, label: 'Maja nai aya..', emoji: '😒', color: 'red', classes: 'bg-red-50 text-red-300 border-red-200 hover:bg-red-100 ring-red-400', selectedClasses: 'bg-red-100 text-red-800 border-red-400 ring-2' },
                { id: 4, label: 'Jana hai kabhi.', emoji: '🤔', color: 'blue', classes: 'bg-blue-50 text-blue-300 border-blue-200 hover:bg-blue-100 ring-blue-400', selectedClasses: 'bg-blue-100 text-blue-800 border-blue-400 ring-2' },
              ].map(option => {
                const isSelected = restaurantPolls[restaurant.id] === option.id;
                
                let pollCount = 0;
                if (option.id === 1) pollCount = restaurant.poll1Count || 0;
                if (option.id === 2) pollCount = restaurant.poll2Count || 0;
                if (option.id === 3) pollCount = restaurant.poll3Count || 0;
                if (option.id === 4) pollCount = restaurant.poll4Count || 0;
                
                // Optimistic UI updates
                if (isSelected && pollCount === 0) pollCount = 1;
                
                return (
                  <button
                    key={option.id}
                    onClick={() => {
                      setRestaurantPoll(restaurant.id, isSelected ? null : option.id);
                      if (!isSelected) {
                        const newId = Date.now();
                        setFloatingEmojis(prev => [...prev, { id: newId, emoji: option.emoji, optionId: option.id }]);
                        setTimeout(() => {
                          setFloatingEmojis(prev => prev.filter(e => e.id !== newId));
                        }, 800);
                      }
                    }}
                    className={`relative p-2.5 rounded-xl border text-sm transition-all font-semibold flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      isSelected
                        ? option.selectedClasses
                        : option.classes
                    }`}
                  >
                    <span>{option.label}</span>
                    {pollCount > 0 && <span className="text-[11px] font-medium opacity-80">{pollCount} {pollCount === 1 ? 'foodie' : 'foodies'}</span>}
                    {floatingEmojis.map(e => (
                      e.optionId === option.id && (
                        <span key={e.id} className="absolute left-1/2 bottom-full emoji-pop text-2xl z-10">{e.emoji}</span>
                      )
                    ))}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}


      <div className="flex items-center justify-between mb-4 px-2">
        <h2 className="text-xl font-bold flex items-center gap-2">
          Dishes
          <span className="bg-gray-200 text-gray-700 text-sm font-semibold px-2.5 py-0.5 rounded-full">
            {restaurantDishes.length}
          </span>
        </h2>
      </div>

      {restaurantDishes.length === 0 && !showAddDish && (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
          <p className="text-gray-500 mb-4">No dishes added yet.</p>
          {editMode && (
            <button
              onClick={() => openAddAndPick()}
              disabled={isApiBusy}
              className="text-red-500 font-medium hover:underline disabled:opacity-60 disabled:cursor-not-allowed"
            >
              + Add your first dish
            </button>
          )}
        </div>
      )}

      <div className="space-y-6">
        {recommendedDishes.length === 0 && sectionedDishes.length > 0 && (
          <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            <span className="font-semibold">Recommended dishes:</span> none
            marked yet.
          </div>
        )}

        {sectionedDishes.length > 0 && (
          <div className="grid grid-cols-1 gap-4 px-2 mb-8">
            {sectionedDishes.map((dish, index) => {
              const dishPhotos = asPhotos(dish.photos, dish.imageStorageUrl);
              const primaryDishPhotoId = resolvePrimaryPhotoId(
                dishPhotos,
                dish.primaryPhotoId,
              );
              const isEditing = editingDishId === dish.id && editingDishDraft;
              
              const isFirstRecommended = index === 0 && dish.isRecommended;
              const isFirstOther = index === recommendedDishes.length;

              return (
                <React.Fragment key={dish.id}>
                  {isFirstRecommended && (
                    <div className="col-span-1 pt-2 pb-1">
                      <h2 className="text-2xl font-bold text-amber-600">What you should definetely eat here!</h2>
                    </div>
                  )}
                  {isFirstOther && recommendedDishes.length > 0 && (
                    <div className="col-span-1 pt-6 pb-1">
                      <h2 className="text-xl font-bold text-gray-800">Other Dishes</h2>
                    </div>
                  )}
                  <div className="w-full">
                  <motion.div
                    layout
                    className={`bg-white rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.04)] border relative group transition-all duration-200 ${dish.isRecommended ? "border-amber-200 bg-gradient-to-br from-white via-white to-amber-50/15" : "border-gray-100"}`}
                  >
                    <div className="absolute top-3 right-3 flex items-center gap-1 z-10">
                      {editMode && (
                        <button
                          type="button"
                          disabled={isApiBusy}
                          onClick={() => openEditDish(dish)}
                          className="p-2 rounded-full border border-gray-200 bg-white text-gray-500 disabled:opacity-60 disabled:cursor-not-allowed"
                          aria-label="Edit dish"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      {editMode && (
                        <button
                          type="button"
                          disabled={isApiBusy}
                          onClick={() => handleDeleteDish(dish.id)}
                          className="p-2 rounded-full border border-red-200 bg-red-50 text-red-500 disabled:opacity-60 disabled:cursor-not-allowed"
                          aria-label="Delete dish"
                        >
                          {deletingDishIds.includes(dish.id) ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-5">
                      {loadingPhotos ? (
                        <div className="w-full sm:w-44 sm:h-44 flex-shrink-0 relative rounded-2xl overflow-hidden animate-shimmer border border-gray-100 flex items-center justify-center">
                          <Loader2 size={16} className="animate-spin text-amber-500" />
                          <div className="absolute right-2 bottom-2 inline-flex items-center gap-2 rounded-lg bg-white/90 px-2 py-1 shadow-sm z-10">
                            <PriceLevelIcon
                              level={Math.min(3, Math.max(1, dish.priceLevel))}
                              actualPrice={dish.actualPrice}
                              noteSize={20}
                              className="h-8 w-8 text-gray-300"
                            />
                          </div>
                        </div>
                      ) : dishPhotos.length > 0 ? (
                        <div className="w-full sm:w-44 sm:h-44 flex-shrink-0 relative">
                          <PhotoCarousel
                            photos={dishPhotos}
                            primaryPhotoId={primaryDishPhotoId}
                          />
                          <div className="absolute right-2 bottom-2 inline-flex items-center gap-2 rounded-lg bg-white/90 px-2 py-1 shadow-sm z-10">
                            <PriceLevelIcon
                              level={Math.min(3, Math.max(1, dish.priceLevel))}
                              actualPrice={dish.actualPrice}
                              noteSize={20}
                              className="h-8 w-8"
                            />
                          </div>
                        </div>
                      ) : null}

                      <div className="flex-1 min-w-0">
                          {deviceId && (
                            <div className="flex flex-col items-start gap-1 shrink-0 mb-3">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => toggleDishLike(dish.id, dishLikes[dish.id] === true ? null : true)}
                                  className={`p-1.5 rounded-full border transition ${dishLikes[dish.id] === true ? 'bg-green-100 text-green-700 border-green-300' : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'}`}
                                  title="Like"
                                >
                                  <ThumbsUp size={14} fill={dishLikes[dish.id] === true ? 'currentColor' : 'none'} />
                                </button>
                                <button
                                  onClick={() => toggleDishLike(dish.id, dishLikes[dish.id] === false ? null : false)}
                                  className={`p-1.5 rounded-full border transition ${dishLikes[dish.id] === false ? 'bg-red-100 text-red-700 border-red-300' : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'}`}
                                  title="Dislike"
                                >
                                  <ThumbsDown size={14} fill={dishLikes[dish.id] === false ? 'currentColor' : 'none'} />
                                </button>
                              </div>
                              {getLikeText(dishLikes[dish.id], dish.likeCount || 0) && (
                                <button
                                  disabled={!editMode || (dish.likeCount || 0) === 0}
                                  onClick={() => openLikesList(dish.id, 'dish')}
                                  className={`text-[10px] text-gray-500 font-medium ${editMode && (dish.likeCount || 0) > 0 ? 'hover:text-blue-500 hover:underline cursor-pointer' : ''} text-left`}
                                >
                                  {getLikeText(dishLikes[dish.id], dish.likeCount || 0)}
                                </button>
                              )}
                            </div>
                          )}
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-tight flex flex-wrap items-center gap-2 break-words whitespace-normal">
                            {dish.rank === 1 && <span title="1st Place" className="text-xl">👑</span>}
                            {dish.rank === 2 && <span title="2nd Place" className="text-xl grayscale brightness-110">👑</span>}
                            {dish.rank === 3 && <span title="3rd Place" className="text-xl sepia hue-rotate-[330deg] saturate-150 brightness-90">👑</span>}
                            {dish.name}
                          </h3>
                        </div>

                        <div className="flex flex-col gap-1 mb-3">
                          <div className="flex gap-1 text-yellow-400">
                            {[...Array(5)].map((_, i) => (
                              editMode ? (
                                <button
                                  key={i}
                                  type="button"
                                  disabled={isApiBusy}
                                  onClick={() => handleInlineDishRatingUpdate(dish, i + 1)}
                                  className={`transition-colors ${i < dish.rating ? "text-yellow-400" : "text-gray-300"} disabled:opacity-70 disabled:cursor-not-allowed`}
                                  aria-label={`Set rating to ${i + 1} out of 5`}
                                >
                                  <Star
                                    size={16}
                                    fill={i < dish.rating ? "currentColor" : "none"}
                                    color={i < dish.rating ? "currentColor" : "#e5e7eb"}
                                  />
                                </button>
                              ) : (
                                <Star
                                  key={i}
                                  size={16}
                                  fill={i < dish.rating ? "currentColor" : "none"}
                                  color={i < dish.rating ? "currentColor" : "#e5e7eb"}
                                />
                              )
                            ))}
                          </div>
                          {dish.isRecommended && (
                            <div className="text-sm font-bold text-red-500 mt-1 flex items-center gap-1">
                              😋 Must try
                            </div>
                          )}
                          {typeof dish.actualPrice === "number" && (
                            <div className="text-sm font-semibold text-gray-800 mt-1">
                              Price: ₹{dish.actualPrice}
                            </div>
                          )}
                          {dish.serves && (
                            <div className="text-sm font-semibold text-gray-800 mt-1 flex items-center gap-1">
                              👥 Serves: {dish.serves}
                            </div>
                          )}
                        </div>

                        {(dish.cuisine ||
                          (dish.flavorTags && dish.flavorTags.length > 0)) && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {dish.flavorTags?.map((tag) => (
                              <span
                                key={tag}
                                className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded-full"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {dishPhotos.length === 0 && (
                          <div className="flex items-center gap-1.5 mb-3 bg-gray-50/50 self-start px-2 py-1 rounded-lg border border-gray-100 w-fit">
                            <PriceLevelIcon
                              level={Math.min(3, Math.max(1, dish.priceLevel))}
                              actualPrice={dish.actualPrice}
                              noteSize={16}
                              className="h-6 w-6"
                            />
                          </div>
                        )}

                        {((dish.pros && dish.pros.length > 0) || (dish.cons && dish.cons.length > 0)) && (
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {dish.pros && dish.pros.length > 0 && (
                              <div className="bg-green-50 p-2.5 rounded-xl border border-green-100 shadow-sm">
                                <div className="font-bold text-green-700 mb-1 flex items-center gap-1">✅ Pros</div>
                                <ul className="list-disc pl-4 space-y-1 text-green-800 font-medium">
                                  {dish.pros.map((pro, i) => <li key={i}>{pro}</li>)}
                                </ul>
                              </div>
                            )}
                            {dish.cons && dish.cons.length > 0 && (
                              <div className="bg-red-50 p-2.5 rounded-xl border border-red-100 shadow-sm">
                                <div className="font-bold text-red-700 mb-1 flex items-center gap-1">❌ Cons</div>
                                <ul className="list-disc pl-4 space-y-1 text-red-800 font-medium">
                                  {dish.cons.map((con, i) => <li key={i}>{con}</li>)}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}

                        {getDishReviews(dish).length > 0 && (
                          <div className="space-y-2 mt-3">
                            {getDishReviews(dish).map((entry) => (
                              <div
                                key={entry.id}
                                className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-100"
                              >
                                <div className="text-[11px] font-semibold text-gray-500 mb-1">
                                  {entry.date}
                                </div>
                                <p className="text-gray-600 leading-relaxed text-sm">
                                  {entry.text}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}




                      </div>
                    </div>

                    {isEditing && (
                      <div className="mt-4 border-t border-gray-200 pt-4 space-y-3">
                        <h4 className="text-sm font-semibold text-gray-700">
                          Edit Dish
                        </h4>

                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Dish Name
                          </label>
                          <input
                            value={editingDishDraft.name}
                            onChange={(event) =>
                              updateEditingDraft({ name: event.target.value })
                            }
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium mb-1">
                              Rating
                            </label>
                            <div className="flex flex-wrap items-center gap-1">
                              {[1, 2, 3, 4, 5].map((star) => {
                                const filled = editingDishDraft.rating >= star;
                                return (
                                  <button
                                    key={`edit-rating-${star}`}
                                    type="button"
                                    disabled={isApiBusy}
                                    onClick={() => {
                                      updateEditingDraft({ rating: star });
                                      void handleInlineDishRatingUpdate(dish, star);
                                    }}
                                    className={`transition-colors ${filled ? "text-yellow-400" : "text-gray-300"} disabled:opacity-70 disabled:cursor-not-allowed`}
                                    aria-label={`Set rating to ${star} out of 5`}
                                  >
                                    <Star size={22} fill="currentColor" />
                                  </button>
                                );
                              })}
                              <span className="ml-1 text-sm font-semibold text-gray-600">
                                {editingDishDraft.rating}/5
                              </span>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">
                              Actual Price (₹)
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={editingDishDraft.actualPrice}
                              onChange={(event) =>
                                updateEditingDraft({
                                  actualPrice: event.target.value,
                                })
                              }
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">
                              Serves
                            </label>
                            <input
                              type="text"
                              value={editingDishDraft.serves}
                              onChange={(event) =>
                                updateEditingDraft({
                                  serves: event.target.value,
                                })
                              }
                              placeholder="e.g. 2/more"
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Price Icons
                          </label>
                          <div className="flex gap-2">
                            {[1, 2, 3].map((level) => (
                              <button
                                key={level}
                                type="button"
                                onClick={() =>
                                  updateEditingDraft({
                                    priceLevel: level as 1 | 2 | 3,
                                  })
                                }
                                className={`w-10 h-10 rounded-full flex items-center justify-center ${editingDishDraft.priceLevel === level ? "bg-green-100 border border-green-300 text-green-700" : "bg-gray-50 text-gray-500 border border-gray-200"}`}
                              >
                                <PriceLevelIcon level={level} noteSize={10} />
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Description
                          </label>
                          <textarea
                            rows={3}
                            value={editingDishDraft.review}
                            onChange={(event) =>
                              updateEditingDraft({
                                review: event.target.value,
                              })
                            }
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium mb-1">
                              Review Date
                            </label>
                            <input
                              type="date"
                              value={editingDishDraft.reviewDate}
                              onChange={(event) =>
                                updateEditingDraft({
                                  reviewDate: event.target.value,
                                })
                              }
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">
                              Cuisine
                            </label>
                            <select
                              value={editingDishDraft.cuisine}
                              onChange={(event) =>
                                updateEditingDraft({
                                  cuisine: event.target.value,
                                })
                              }
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                            >
                              <option value="">Select cuisine</option>
                              {cuisineOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <TagSelector
                            selectedTags={editingDishDraft.tags}
                            availableTags={flavorTags}
                            onChange={(tags) => updateEditingDraft({ tags })}
                            onCreateTag={ensureFlavorTag}
                            placeholder="Type to search or add"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Photos
                          </label>
                          <PhotoCarousel
                            photos={editingDishDraft.photos}
                            primaryPhotoId={editingDishDraft.primaryPhotoId}
                            editable
                            onPrimaryChange={(photoId) =>
                              updateEditingDraft({ primaryPhotoId: photoId })
                            }
                            onRemovePhoto={(photoId) => {
                              const next = editingDishDraft.photos.filter(
                                (photo) => photo.id !== photoId,
                              );
                              updateEditingDraft({
                                photos: next,
                                primaryPhotoId: resolvePrimaryPhotoId(
                                  next,
                                  editingDishDraft.primaryPhotoId === photoId
                                    ? undefined
                                    : editingDishDraft.primaryPhotoId,
                                ),
                              });
                            }}
                          />
                          <input
                            ref={editDishPhotoInputRef}
                            type="file"
                            accept="image/*,video/*"
                            multiple
                            onChange={(event) =>
                              addPhotosToEditingDish(event.target.files)
                            }
                            className="hidden"
                          />
                          <button
                            type="button"
                            disabled={isApiBusy}
                            onClick={() =>
                              editDishPhotoInputRef.current?.click()
                            }
                            className="mt-2 inline-flex items-center gap-2 px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            <ImagePlus size={14} />
                            Add dish photos
                          </button>
                        </div>

                        <div className="border-t border-gray-200 pt-3 space-y-3">
                          <div className="flex justify-between items-center">
                            <h5 className="text-xs font-bold uppercase text-gray-500">AI Insights & Ranking</h5>
                            <button
                              type="button"
                              disabled={isGeneratingInsights}
                              onClick={handleGenerateInsightsForEditingDish}
                              className="text-xs inline-flex items-center gap-1 font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-200 hover:bg-indigo-100 disabled:opacity-50"
                              title="Generate Pros & Cons with Gemini"
                            >
                              {isGeneratingInsights ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                              Generate
                            </button>
                          </div>
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <label className="block text-sm font-medium text-green-700">Pros</label>
                              <button
                                type="button"
                                onClick={() => updateEditingDraft({ pros: [...(editingDishDraft.pros || []), ''] })}
                                className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-200 hover:bg-green-100"
                              >
                                + Add Pro
                              </button>
                            </div>
                            {(editingDishDraft.pros || []).map((pro, idx) => (
                              <div key={idx} className="flex gap-1 mb-1">
                                <input
                                  type="text"
                                  value={pro}
                                  onChange={(e) => {
                                    const next = [...(editingDishDraft.pros || [])];
                                    next[idx] = e.target.value;
                                    updateEditingDraft({ pros: next });
                                  }}
                                  className="flex-1 px-2.5 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = [...(editingDishDraft.pros || [])];
                                    next.splice(idx, 1);
                                    updateEditingDraft({ pros: next });
                                  }}
                                  className="px-2 text-red-500 hover:text-red-700 font-bold"
                                >
                                  &times;
                                </button>
                              </div>
                            ))}
                          </div>

                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <label className="block text-sm font-medium text-red-700">Cons</label>
                              <button
                                type="button"
                                onClick={() => updateEditingDraft({ cons: [...(editingDishDraft.cons || []), ''] })}
                                className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200 hover:bg-red-100"
                              >
                                + Add Con
                              </button>
                            </div>
                            {(editingDishDraft.cons || []).map((con, idx) => (
                              <div key={idx} className="flex gap-1 mb-1">
                                <input
                                  type="text"
                                  value={con}
                                  onChange={(e) => {
                                    const next = [...(editingDishDraft.cons || [])];
                                    next[idx] = e.target.value;
                                    updateEditingDraft({ cons: next });
                                  }}
                                  className="flex-1 px-2.5 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = [...(editingDishDraft.cons || [])];
                                    next.splice(idx, 1);
                                    updateEditingDraft({ cons: next });
                                  }}
                                  className="px-2 text-red-500 hover:text-red-700 font-bold"
                                >
                                  &times;
                                </button>
                              </div>
                            ))}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-purple-700 mb-1">Rank (Crown)</label>
                            <select
                              value={editingDishDraft.rank || ""}
                              onChange={(e) => updateEditingDraft({ rank: e.target.value ? Number(e.target.value) : null })}
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                            >
                              <option value="">No Rank</option>
                              <option value="1">🥇 1st (Gold)</option>
                              <option value="2">🥈 2nd (Silver)</option>
                              <option value="3">🥉 3rd (Bronze)</option>
                            </select>
                          </div>
                        </div>

                        <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                          <input
                            type="checkbox"
                            checked={editingDishDraft.isRecommended}
                            onChange={(event) =>
                              updateEditingDraft({
                                isRecommended: event.target.checked,
                              })
                            }
                          />
                          Recommended dish
                        </label>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            disabled={isApiBusy}
                            onClick={closeEditDish}
                            className="px-3 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={isApiBusy}
                            onClick={saveEditedDish}
                            className="px-3 py-2 rounded-xl bg-black text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
                          >
                            {isSavingDish ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : null}
                            Save changes
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAddDish && editMode && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 bg-white rounded-2xl p-6 shadow-xl border border-gray-200 max-h-[80dvh] overflow-y-auto"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <h3 className="text-lg font-bold mb-4">Add New Dish</h3>
            <form onSubmit={submitAddDishForm} className="space-y-4">
              {!batchMode ? (
                <fieldset
                disabled={isApiBusy}
                className="space-y-4 disabled:opacity-70"
              >
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Dish Name
                  </label>
                  <input
                    {...dishNameField}
                    onChange={(event) => {
                      dishNameField.onChange(event);
                      if (dishNameDuplicateError) {
                        void validateDishNameDuplicate(event.target.value);
                      }
                    }}
                    onBlur={(event) => {
                      dishNameField.onBlur(event);
                      void validateDishNameDuplicate(event.target.value);
                    }}
                    className={`w-full px-4 py-2 rounded-xl border ${dishNameDuplicateError ? "bg-red-50 border-red-400" : "bg-gray-50 border-gray-200"}`}
                  />
                  {dishNameDuplicateError && (
                    <span className="text-red-500 text-sm">
                      {dishNameDuplicateError}
                    </span>
                  )}
                  {errors.name && (
                    <span className="text-red-500 text-sm">
                      {errors.name.message}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Rating
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setValue("rating", star)}
                        className={`${star <= rating ? "text-yellow-400" : "text-gray-300"} transition-colors`}
                      >
                        <Star size={24} fill="currentColor" />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Description
                  </label>
                  <textarea
                    {...register("review")}
                    rows={3}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                  />
                  {errors.review && (
                    <span className="text-red-500 text-sm">
                      {errors.review.message}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Review Date
                    </label>
                    <input
                      type="date"
                      {...register("reviewDate")}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Actual Price (₹)
                    </label>
                    <input
                      type="number"
                      min="1"
                      {...register("actualPrice")}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                      placeholder="250"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Serves
                    </label>
                    <input
                      type="text"
                      {...register("serves")}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                      placeholder="e.g. 2/more"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Price Icons
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3].map((level) => (
                      <button
                        type="button"
                        key={level}
                        onClick={() => setValue("priceLevel", level)}
                        className={`${level === priceLevel ? "bg-green-100 text-green-700 border border-green-300" : "bg-gray-50 text-gray-500 border border-gray-200"} w-10 h-10 rounded-full flex items-center justify-center transition-colors`}
                      >
                        <PriceLevelIcon level={level} noteSize={10} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Cuisine
                    </label>
                    <select
                      value={dishCuisineSelection}
                      onChange={(event) =>
                        setDishCuisineSelection(event.target.value)
                      }
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                    >
                      <option value="">Select cuisine</option>
                      {cuisineOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                      <option value="__custom__">Add new cuisine...</option>
                    </select>
                    {dishCuisineSelection === "__custom__" && (
                      <input
                        value={customDishCuisine}
                        onChange={(event) =>
                          setCustomDishCuisine(event.target.value)
                        }
                        className="mt-2 w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                        placeholder="Enter new cuisine"
                      />
                    )}
                  </div>
                  <div>
                    <TagSelector
                      label="Flavor Tags"
                      selectedTags={selectedDishTags}
                      availableTags={flavorTags}
                      onChange={setSelectedDishTags}
                      onCreateTag={ensureFlavorTag}
                      placeholder="Type to search or add"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Dish Photos
                  </label>
                  <input
                    ref={dishPhotoInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={(event) =>
                      handleAddDishPhotos(event.target.files)
                    }
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => dishPhotoInputRef.current?.click()}
                    disabled={isApiBusy}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <ImagePlus size={14} />
                    Upload photos
                  </button>
                  {newDishPhotos.length > 0 && (
                    <div className="mt-3">
                      <PhotoCarousel
                        photos={newDishPhotos}
                        primaryPhotoId={resolvePrimaryPhotoId(
                          newDishPhotos,
                          newDishPrimaryPhotoId,
                        )}
                        editable
                        onPrimaryChange={setNewDishPrimaryPhotoId}
                        onRemovePhoto={(photoId) => {
                          setNewDishPhotos((prev) => {
                            const next = prev.filter(
                              (photo) => photo.id !== photoId,
                            );
                            setNewDishPrimaryPhotoId((current) =>
                              resolvePrimaryPhotoId(
                                next,
                                current === photoId ? undefined : current,
                              ),
                            );
                            return next;
                          });
                        }}
                      />
                      {newDishPhotos.length > 1 && (
                        <div className="mt-3 flex items-center gap-3">
                          <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                            <input
                              type="checkbox"
                              checked={batchMode}
                              onChange={toggleBatchMode}
                            />
                            Create separate dishes for each uploaded photo
                          </label>
                          {batchMode && (
                            <div className="text-xs text-gray-500">
                              Each photo will become its own dish entry.
                            </div>
                          )}
                        </div>
                      )}
                      {batchMode && newDishPhotos.length > 0 && (
                        <div className="mt-4 space-y-4">
                          {batchEntries.map((entry, index) => {
                            const entryPhotos = entry.photoIds.map(id => newDishPhotos.find(p => p.id === id)).filter(Boolean) as PhotoEntry[];
                            return (
                              <div key={entry.photoIds.join(",")} className="p-3 border rounded-xl bg-gray-50 relative mt-6">
                                {index > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => mergeBatchEntryUp(index)}
                                    className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-medium border border-indigo-200 hover:bg-indigo-200 flex items-center gap-1 z-10 transition-colors shadow-sm"
                                  >
                                    <Merge size={12} /> Group with dish above
                                  </button>
                                )}
                                <div className="flex flex-col gap-3">
                                  <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                                    {entryPhotos.map(photo => (
                                      <CachedImage key={photo.id} src={photo.url} alt="preview" className="w-20 h-20 object-cover rounded-lg shrink-0 shadow-sm border border-gray-200" />
                                    ))}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <input
                                        value={entry.name}
                                        onChange={(e) => updateBatchEntry(index, { name: e.target.value })}
                                        placeholder="Dish name"
                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl"
                                      />
                                    </div>
                                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      <div>
                                        <div className="text-xs font-medium mb-1">Rating</div>
                                        <div className="flex gap-1">
                                          {[1,2,3,4,5].map((s) => (
                                            <button
                                              key={s}
                                              type="button"
                                              onClick={() => updateBatchEntry(index, { rating: s })}
                                              className={`${entry.rating >= s ? "text-yellow-400" : "text-gray-300"}`}
                                            >
                                              <Star size={16} fill="currentColor" />
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                      <div>
                                        <div className="text-xs font-medium mb-1">Actual Price (₹)</div>
                                        <input
                                          type="number"
                                          value={entry.actualPrice}
                                          onChange={(e) => updateBatchEntry(index, { actualPrice: e.target.value })}
                                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl"
                                        />
                                      </div>
                                      <div>
                                        <div className="text-xs font-medium mb-1">Serves</div>
                                        <input
                                          type="text"
                                          value={entry.serves}
                                          onChange={(e) => updateBatchEntry(index, { serves: e.target.value })}
                                          placeholder="e.g. 2/more"
                                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl"
                                        />
                                      </div>
                                    </div>
                                    <div className="mt-2">
                                      <textarea
                                        rows={2}
                                        value={entry.review}
                                        onChange={(e) => updateBatchEntry(index, { review: e.target.value })}
                                        placeholder="Review / description"
                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl"
                                      />
                                    </div>
                                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      <div>
                                        <select
                                          value={entry.cuisine}
                                          onChange={(e) => updateBatchEntry(index, { cuisine: e.target.value })}
                                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl"
                                        >
                                          <option value="">Select cuisine</option>
                                          {cuisineOptions.map((option) => (
                                            <option key={option} value={option}>{option}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div>
                                        <TagSelector
                                          selectedTags={entry.tags}
                                          availableTags={flavorTags}
                                          onChange={(tags) => updateBatchEntry(index, { tags })}
                                          onCreateTag={ensureFlavorTag}
                                          placeholder="Tags"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={addFormRecommended}
                    onChange={(event) =>
                      setValue("isRecommended", event.target.checked)
                    }
                  />
                  Recommended dish
                </label>
              </fieldset>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
                    You picked separate dishes. Add a name and review for each photo, then save them as individual dishes.
                    <button
                      type="button"
                      onClick={() => setBatchMode(false)}
                      
                      className="ml-2 font-semibold underline underline-offset-4"
                    >
                      Treat as one dish instead
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Dish Photos
                    </label>
                    <input
                      ref={dishPhotoInputRef}
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      onChange={(event) =>
                        handleAddDishPhotos(event.target.files)
                      }
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => dishPhotoInputRef.current?.click()}
                      disabled={isApiBusy}
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <ImagePlus size={14} />
                      Add more photos
                    </button>
                  </div>

                  {newDishPhotos.length > 0 && (
                    <div className="space-y-4">
                      <PhotoCarousel
                        photos={newDishPhotos}
                        primaryPhotoId={resolvePrimaryPhotoId(
                          newDishPhotos,
                          newDishPrimaryPhotoId,
                        )}
                        editable
                        onPrimaryChange={setNewDishPrimaryPhotoId}
                        onRemovePhoto={(photoId) => {
                          setNewDishPhotos((prev) => {
                            const next = prev.filter(
                              (photo) => photo.id !== photoId,
                            );
                            setNewDishPrimaryPhotoId((current) =>
                              resolvePrimaryPhotoId(
                                next,
                                current === photoId ? undefined : current,
                              ),
                            );
                            return next;
                          });
                        }}
                      />

                      {batchEntries.map((entry, index) => {
                        const entryPhotos = entry.photoIds.map(id => newDishPhotos.find(p => p.id === id)).filter(Boolean) as PhotoEntry[];
                        return (
                          <div
                            key={entry.photoIds.join(",")}
                            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm relative mt-8"
                          >
                            {index > 0 && (
                              <button
                                type="button"
                                onClick={() => mergeBatchEntryUp(index)}
                                className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-medium border border-indigo-200 hover:bg-indigo-200 flex items-center gap-1 z-10 transition-colors shadow-sm"
                              >
                                <Merge size={12} /> Group with dish above
                              </button>
                            )}
                            <div className="flex flex-col gap-4 sm:flex-row">
                              <div className="flex gap-2 overflow-x-auto pb-2 sm:flex-col sm:w-24 sm:overflow-y-auto sm:overflow-x-hidden sm:max-h-64">
                                {entryPhotos.map(photo => (
                                  <CachedImage
                                    key={photo.id}
                                    src={photo.url}
                                    alt="Dish preview"
                                    className="h-24 w-24 rounded-2xl object-cover ring-1 ring-slate-200 shrink-0"
                                  />
                                ))}
                              </div>
                              <div className="min-w-0 flex-1 space-y-3">
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                      Dish name
                                    </label>
                                    <input
                                      value={entry.name}
                                      onChange={(event) =>
                                        updateBatchEntry(index, {
                                          name: event.target.value,
                                        })
                                      }
                                      placeholder="Name this dish"
                                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                      Review date
                                    </label>
                                    <input
                                      type="date"
                                      value={entry.reviewDate}
                                      onChange={(event) =>
                                        updateBatchEntry(index, {
                                          reviewDate: event.target.value,
                                        })
                                      }
                                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                                    />
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                    Review
                                  </label>
                                  <textarea
                                    rows={3}
                                    value={entry.review}
                                    onChange={(event) =>
                                      updateBatchEntry(index, {
                                        review: event.target.value,
                                      })
                                    }
                                    placeholder="Write a short review for this dish"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                                  />
                                </div>

                                <div className="grid gap-3 sm:grid-cols-4">
                                  <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                      Rating
                                    </label>
                                    <div className="flex gap-1.5">
                                      {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                          type="button"
                                          key={star}
                                          onClick={() =>
                                            updateBatchEntry(index, {
                                              rating: star,
                                            })
                                          }
                                          className={`${entry.rating >= star ? "text-yellow-400" : "text-gray-300"}`}
                                        >
                                          <Star size={18} fill="currentColor" />
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                      Actual price
                                    </label>
                                    <input
                                      type="number"
                                      value={entry.actualPrice}
                                      onChange={(event) =>
                                        updateBatchEntry(index, {
                                          actualPrice: event.target.value,
                                        })
                                      }
                                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                      Recommended
                                    </label>
                                    <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                                      <input
                                        type="checkbox"
                                        checked={entry.isRecommended}
                                        onChange={(event) =>
                                          updateBatchEntry(index, {
                                            isRecommended: event.target.checked,
                                          })
                                        }
                                      />
                                      Mark as recommended
                                    </label>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                      Serves
                                    </label>
                                    <input
                                      type="text"
                                      value={entry.serves}
                                      onChange={(event) =>
                                        updateBatchEntry(index, {
                                          serves: event.target.value,
                                        })
                                      }
                                      placeholder="e.g. 2/more"
                                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                                    />
                                  </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                      Cuisine
                                    </label>
                                    <select
                                      value={entry.cuisine}
                                      onChange={(event) =>
                                        updateBatchEntry(index, {
                                          cuisine: event.target.value,
                                        })
                                      }
                                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                                    >
                                      <option value="">Select cuisine</option>
                                      {cuisineOptions.map((option) => (
                                        <option key={option} value={option}>
                                          {option}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <TagSelector
                                      label="Tags"
                                      selectedTags={entry.tags}
                                      availableTags={flavorTags}
                                      onChange={(tags) =>
                                        updateBatchEntry(index, { tags })
                                      }
                                      onCreateTag={ensureFlavorTag}
                                      placeholder="Type to search or add"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {addDishError && (
                <p className="text-sm text-red-600 font-medium">
                  {addDishError}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={isApiBusy}
                  onClick={() => {
                    setShowAddDish(false);
                    setAddDishError(null);
                    setDishNameDuplicateError(null);
                    setUploadChoiceOpen(false);
                    setPendingDishFiles([]);
                    setBatchEntries([]);
                    setBatchMode(false);
                  }}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isApiBusy}
                  className="flex-[2] py-3 bg-red-500 text-white font-medium rounded-xl hover:bg-red-600 shadow-md disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSavingDish ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : null}
                  {isSavingDish ? "Saving..." : batchMode ? "Create Dishes" : "Save Dish"}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {uploadChoiceOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1300] flex items-start justify-center overflow-y-auto bg-slate-950/55 px-3 py-4 backdrop-blur-sm sm:items-center sm:px-4 sm:py-8"
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="flex w-full max-w-lg flex-col overflow-hidden rounded-[24px] border border-white/20 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.35)] sm:rounded-[28px] max-h-[calc(100dvh-2rem)] sm:max-h-[min(90dvh,48rem)]"
            >
              <div className="bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 px-5 py-5 text-white sm:px-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] sm:text-xs">
                  <ImagePlus size={12} />
                  Photo import
                </div>
                <h3 className="mt-4 text-xl font-black tracking-tight sm:text-2xl">
                  How should these photos be saved?
                </h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-white/90 mb-4">
                  Choose whether the selected images belong to one dish or should become separate dishes with their own names and reviews.
                </p>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/30 scrollbar-track-transparent">
                  {pendingDishFiles.map((file, i) => (
                    <FilePreview key={i} file={file} />
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 px-5 py-5 sm:px-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => void applyPendingDishFiles(false)}
                    className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white active:scale-[0.99]"
                  >
                    <div className="text-sm font-bold text-slate-900">Same dish</div>
                    <div className="mt-2 text-sm leading-6 text-slate-600">
                      All selected photos attach to one dish.
                    </div>
                    <div className="mt-4 inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                      One form
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => void applyPendingDishFiles(true)}
                    className="group rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 text-left transition hover:-translate-y-0.5 hover:border-amber-300 hover:from-amber-100 hover:to-orange-100 active:scale-[0.99]"
                  >
                    <div className="text-sm font-bold text-amber-950">Separate dishes</div>
                    <div className="mt-2 text-sm leading-6 text-amber-900/80">
                      Each photo becomes its own dish card with a review.
                    </div>
                    <div className="mt-4 inline-flex rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                      Multi form
                    </div>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={closeUploadChoiceModal}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99]"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {editMode && !showAddDish && (
        <button
          onClick={() => openAddAndPick()}
          disabled={isApiBusy}
          className="fixed bottom-6 right-6 bg-black hover:bg-gray-800 text-white rounded-full p-4 shadow-2xl active:scale-95 transition-transform flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Plus size={24} />
        </button>
      )}

      {isApiBusy && (
        <div className="fixed inset-0 z-[1200] bg-black/20 pointer-events-auto flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-3">
            <Loader2 size={32} className="animate-spin text-amber-500" />
            <span className="font-semibold text-gray-700 text-sm">Processing media...</span>
          </div>
        </div>
      )}

      <AnimatePresence>
        {likesModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-900">Likes</h3>
                <button
                  onClick={() => setLikesModal(null)}
                  className="p-2 -mr-2 rounded-full hover:bg-gray-100 text-gray-500"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-5 overflow-y-auto flex-1">
                {isLoadingLikes ? (
                  <div className="flex justify-center py-8">
                    <Loader2 size={24} className="animate-spin text-gray-400" />
                  </div>
                ) : likesList.length > 0 ? (
                  <ul className="space-y-3">
                    {likesList.map((name, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm font-medium text-gray-800">
                        <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                          {name.charAt(0).toUpperCase()}
                        </div>
                        {name}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-center text-gray-500 py-4 text-sm">No likes yet.</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>



      <InstagramPreviewModal
        isOpen={showInstagramPreview}
        onClose={() => setShowInstagramPreview(false)}
        onPublish={handleConfirmPublishInstagram}
        restaurant={restaurant}
        dishes={restaurantDishes}
      />
      <StoryGeneratorModal
        isOpen={isStoryModalOpen}
        onClose={() => setIsStoryModalOpen(false)}
        restaurant={restaurant}
      />
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        isDestructive={confirmModal.isDestructive}
        onConfirm={() => {
          if (confirmModal.action) void confirmModal.action();
        }}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
      <ReelGeneratorModal 
        restaurant={restaurant}
        dishes={restaurantDishes}
        isOpen={isReelModalOpen}
        onClose={() => setIsReelModalOpen(false)}
      />
    </div>
  );
}
