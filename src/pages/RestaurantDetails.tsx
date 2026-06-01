import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { useForm as useRHForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import TagSelector from "../components/TagSelector";
import PriceLevelIcon from "../components/PriceLevelIcon";
import PhotoCarousel from "../components/PhotoCarousel";
import { useStore } from "../store/useStore";
import { Dish, DishReview, PhotoEntry } from "../types";
import { optimizeImage } from "../lib/imageOptimization";

const dishSchema = z.object({
  name: z.string().trim().min(1, "Dish name is required"),
  rating: z.number().min(1).max(5),
  priceLevel: z.number().min(1).max(3).optional(),
  actualPrice: z.string().optional(),
  review: z.string().trim().min(1, "Description is required"),
  reviewDate: z.string().optional(),
  cuisine: z.string().optional(),
  isRecommended: z.boolean().optional(),
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
  photos: PhotoEntry[];
  primaryPhotoId?: string;
  tags: string[];
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

const asPhotos = (
  photos?: PhotoEntry[],
  fallbackUrl?: string,
): PhotoEntry[] => {
  const valid = (photos ?? []).filter((photo) => Boolean(photo.url));
  if (valid.length > 0) return valid;
  if (!fallbackUrl) return [];
  return [
    {
      id: `legacy-${fallbackUrl.slice(0, 24)}`,
      url: fallbackUrl,
      uploadedAt: new Date().toISOString(),
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
  } = useStore();

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
    const restaurantNeedsRefresh = !restaurant.photos?.length && !restaurant.imageUrl;
    const dishesNeedRefresh = restaurantDishes.some(
      (dish) => !dish.photos?.length && !dish.imageUrl,
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
      photoId: string;
      name: string;
      rating: number;
      priceLevel: 1 | 2 | 3;
      actualPrice: string;
      review: string;
      reviewDate: string;
      cuisine: string;
      tags: string[];
      isRecommended: boolean;
    }>
  >([]);
  const [uploadChoiceOpen, setUploadChoiceOpen] = useState(false);
  const [pendingDishFiles, setPendingDishFiles] = useState<File[]>([]);
  const [addDishError, setAddDishError] = useState<string | null>(null);
  const [editingDishId, setEditingDishId] = useState<string | null>(null);
  const [editingDishDraft, setEditingDishDraft] =
    useState<DishEditDraft | null>(null);

  const [isSavingDish, setIsSavingDish] = useState(false);
  const [isSavingRestaurantPhoto, setIsSavingRestaurantPhoto] = useState(false);
  const [isSavingMetrics, setIsSavingMetrics] = useState(false);
  const [isDeletingRestaurant, setIsDeletingRestaurant] = useState(false);
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
      const map = new Map(prev.map((e) => [e.photoId, e]));
      const next = newDishPhotos.map((photo) => {
        const existing = map.get(photo.id);
        if (existing) return existing;
        return {
          photoId: photo.id,
          name: "",
          rating: 5,
          priceLevel: 2 as 1 | 2 | 3,
          actualPrice: "",
          review: "",
          reviewDate: new Date().toISOString().slice(0, 10),
          cuisine: "",
          tags: [] as string[],
          isRecommended: false,
        };
      });
      return next;
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
    const urls = await Promise.all(Array.from(files).map((file) => optimizeImage(file)));
    const now = new Date().toISOString();
    return urls.map((url) => ({ id: createId(), url, uploadedAt: now }));
  };

  const restaurantPhotos = asPhotos(restaurant.photos, restaurant.imageUrl);
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
      imageUrl: resolvePrimaryPhotoUrl(photos, nextPrimaryPhotoId) ?? "",
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

  const handleDeleteRestaurant = async () => {
    if (isApiBusy) return;
    if (!confirm("Delete this restaurant and all its dishes?")) return;
    setIsDeletingRestaurant(true);
    navigate("/", { replace: true });
    try {
      await deleteRestaurant(restaurant.id);
    } finally {
      setIsDeletingRestaurant(false);
    }
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

  const handleQuickToggleRecommended = async (dish: Dish) => {
    if (isApiBusy) return;
    setIsSavingDish(true);
    try {
      await updateDish(dish.id, { isRecommended: !dish.isRecommended });
      if (editingDishId === dish.id && editingDishDraft) {
        setEditingDishDraft({
          ...editingDishDraft,
          isRecommended: !dish.isRecommended,
        });
      }
    } finally {
      setIsSavingDish(false);
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
    const photos = asPhotos(dish.photos, dish.imageUrl);
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
      photos,
      primaryPhotoId: resolvePrimaryPhotoId(photos, dish.primaryPhotoId),
      tags: dish.flavorTags ?? [],
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

    setShowAddDish(true);
    const incoming = await filesToPhotos(files);
    setNewDishPhotos((prev) => {
      const next = [...prev, ...incoming];
      setNewDishPrimaryPhotoId((current) =>
        resolvePrimaryPhotoId(next, current),
      );
      return next;
    });

    if (separate) {
      setBatchMode(true);
    } else {
      setBatchMode(false);
      setBatchEntries([]);
    }

    closeUploadChoiceModal();
  };

  const updateBatchEntry = (photoId: string, patch: Partial<typeof batchEntries[number]>) => {
    setBatchEntries((prev) => prev.map((e) => (e.photoId === photoId ? { ...e, ...patch } : e)));
  };

  const openAddAndPick = () => {
    setShowAddDish(true);
    setAddDishError(null);
    setDishNameDuplicateError(null);
    // wait for form/input to render then open file picker
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
        const photo = newDishPhotos.find((p) => p.id === entry.photoId);
        const photos = photo ? [photo] : [];
        const primaryPhotoId = photo?.id;
        const imageUrl = photo?.url;

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
          imageUrl,
          photos: photos.length > 0 ? photos : undefined,
          primaryPhotoId,
          isRecommended: Boolean(entry.isRecommended),
          cuisine: entry.cuisine || undefined,
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
      const imageUrl = resolvePrimaryPhotoUrl(photos, primaryPhotoId);

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
        primaryPhotoId,
        imageUrl,
        isRecommended: editingDishDraft.isRecommended,
      });

      closeEditDish();
    } finally {
      setIsSavingDish(false);
    }
  };

  const handleAddDishPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    // Ensure add-dish form is visible when photos chosen
    setShowAddDish(true);
    if (files.length > 1) {
      setPendingDishFiles(Array.from(files));
      setUploadChoiceOpen(true);
      if (dishPhotoInputRef.current) {
        dishPhotoInputRef.current.value = "";
      }
      return;
    }

    const incoming = await filesToPhotos(files);
    setBatchMode(false);
    setNewDishPhotos((prev) => {
      const next = [...prev, ...incoming];
      setNewDishPrimaryPhotoId((current) =>
        resolvePrimaryPhotoId(next, current),
      );
      return next;
    });

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
      const imageUrl = resolvePrimaryPhotoUrl(newDishPhotos, primaryPhotoId);

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
        imageUrl,
        photos: newDishPhotos.length > 0 ? newDishPhotos : undefined,
        primaryPhotoId,
        isRecommended: Boolean(data.isRecommended),
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
                accept="image/*"
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
        <h1 className="text-3xl font-extrabold text-gray-900">
          {restaurant.name}
        </h1>
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

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            {sectionedDishes.map((dish) => {
              const dishPhotos = asPhotos(dish.photos, dish.imageUrl);
              const primaryDishPhotoId = resolvePrimaryPhotoId(
                dishPhotos,
                dish.primaryPhotoId,
              );
              const isEditing = editingDishId === dish.id && editingDishDraft;

              return (
                <div
                  key={dish.id}
                  className="w-full"
                >
                  <motion.div
                    layout
                    className={`bg-white rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.04)] border relative group transition-all duration-200 ${dish.isRecommended ? "border-amber-200 bg-gradient-to-br from-white via-white to-amber-50/15" : "border-gray-100"}`}
                  >
                    <div className="absolute top-3 right-3 flex items-center gap-1 z-10">
                      <button
                        type="button"
                        disabled={isApiBusy}
                        onClick={() => handleQuickToggleRecommended(dish)}
                        className={`p-2 rounded-full border ${dish.isRecommended ? "bg-amber-50 text-amber-500 border-amber-200" : "bg-white text-gray-400 border-gray-200"} disabled:opacity-60 disabled:cursor-not-allowed`}
                        aria-label="Toggle recommended"
                        title="Mark as recommended"
                      >
                        <Star
                          size={14}
                          fill={dish.isRecommended ? "currentColor" : "none"}
                        />
                      </button>
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
                            {typeof dish.actualPrice === "number" && (
                              <span className="text-gray-400 font-semibold text-xs">
                                ₹{dish.actualPrice}
                              </span>
                            )}
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
                            {typeof dish.actualPrice === "number" && (
                              <span className="text-gray-900 font-semibold text-xs">
                                ₹{dish.actualPrice}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : null}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-2 pr-28">
                          <h3 className="text-lg font-bold text-gray-900 leading-tight flex flex-wrap items-center gap-2">
                            {dish.name}
                            {dish.isRecommended && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                ★ Recommended
                              </span>
                            )}
                          </h3>
                        </div>

                        <div className="flex gap-1 mb-3 text-yellow-400">
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

                        {(dish.cuisine ||
                          (dish.flavorTags && dish.flavorTags.length > 0)) && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {dish.cuisine && (
                              <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded-full">
                                {dish.cuisine}
                              </span>
                            )}
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
                            {typeof dish.actualPrice === "number" && (
                              <span className="text-gray-900 font-semibold text-xs">
                                ₹{dish.actualPrice}
                              </span>
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
                            accept="image/*"
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
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${level === priceLevel ? "bg-green-100 text-green-700 border border-green-300" : "bg-gray-50 text-gray-500 border border-gray-200"}`}
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
                    accept="image/*"
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
                          {newDishPhotos.map((photo) => {
                            const entry = batchEntries.find((b) => b.photoId === photo.id);
                            return (
                              <div key={photo.id} className="p-3 border rounded-xl bg-gray-50">
                                <div className="flex gap-3">
                                  <img src={photo.url} alt="preview" className="w-20 h-20 object-cover rounded-lg" />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <input
                                        value={entry?.name ?? ""}
                                        onChange={(e) => updateBatchEntry(photo.id, { name: e.target.value })}
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
                                              onClick={() => updateBatchEntry(photo.id, { rating: s })}
                                              className={`${(entry?.rating ?? 5) >= s ? "text-yellow-400" : "text-gray-300"}`}
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
                                          value={entry?.actualPrice ?? ""}
                                          onChange={(e) => updateBatchEntry(photo.id, { actualPrice: e.target.value })}
                                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl"
                                        />
                                      </div>
                                    </div>
                                    <div className="mt-2">
                                      <textarea
                                        rows={2}
                                        value={entry?.review ?? ""}
                                        onChange={(e) => updateBatchEntry(photo.id, { review: e.target.value })}
                                        placeholder="Review / description"
                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl"
                                      />
                                    </div>
                                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      <div>
                                        <select
                                          value={entry?.cuisine ?? ""}
                                          onChange={(e) => updateBatchEntry(photo.id, { cuisine: e.target.value })}
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
                                          selectedTags={entry?.tags ?? []}
                                          availableTags={flavorTags}
                                          onChange={(tags) => updateBatchEntry(photo.id, { tags })}
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
                      accept="image/*"
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

                      {newDishPhotos.map((photo) => {
                        const entry = batchEntries.find(
                          (item) => item.photoId === photo.id,
                        );
                        return (
                          <div
                            key={photo.id}
                            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                          >
                            <div className="flex flex-col gap-4 sm:flex-row">
                              <img
                                src={photo.url}
                                alt="Dish preview"
                                className="h-24 w-24 rounded-2xl object-cover ring-1 ring-slate-200"
                              />
                              <div className="min-w-0 flex-1 space-y-3">
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                      Dish name
                                    </label>
                                    <input
                                      value={entry?.name ?? ""}
                                      onChange={(event) =>
                                        updateBatchEntry(photo.id, {
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
                                      value={entry?.reviewDate ?? ""}
                                      onChange={(event) =>
                                        updateBatchEntry(photo.id, {
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
                                    value={entry?.review ?? ""}
                                    onChange={(event) =>
                                      updateBatchEntry(photo.id, {
                                        review: event.target.value,
                                      })
                                    }
                                    placeholder="Write a short review for this dish"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                                  />
                                </div>

                                <div className="grid gap-3 sm:grid-cols-3">
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
                                            updateBatchEntry(photo.id, {
                                              rating: star,
                                            })
                                          }
                                          className={`${(entry?.rating ?? 5) >= star ? "text-yellow-400" : "text-gray-300"}`}
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
                                      value={entry?.actualPrice ?? ""}
                                      onChange={(event) =>
                                        updateBatchEntry(photo.id, {
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
                                        checked={entry?.isRecommended ?? false}
                                        onChange={(event) =>
                                          updateBatchEntry(photo.id, {
                                            isRecommended: event.target.checked,
                                          })
                                        }
                                      />
                                      Mark as recommended
                                    </label>
                                  </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                      Cuisine
                                    </label>
                                    <select
                                      value={entry?.cuisine ?? ""}
                                      onChange={(event) =>
                                        updateBatchEntry(photo.id, {
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
                                      selectedTags={entry?.tags ?? []}
                                      availableTags={flavorTags}
                                      onChange={(tags) =>
                                        updateBatchEntry(photo.id, { tags })
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
                <p className="mt-2 max-w-md text-sm leading-6 text-white/90">
                  Choose whether the selected images belong to one dish or should become separate dishes with their own names and reviews.
                </p>
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
        <div className="fixed inset-0 z-[1200] bg-black/10 pointer-events-auto">
          <div className="absolute top-4 right-4 bg-white rounded-full p-2 shadow">
            <Loader2 size={16} className="animate-spin text-gray-700" />
          </div>
        </div>
      )}
    </div>
  );
}
