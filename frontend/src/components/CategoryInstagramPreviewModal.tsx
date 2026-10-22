import { useState, useEffect } from 'react';
import { X, Download, Share2, Camera, Loader2, Moon, Sun, LayoutGrid, Upload, Settings } from 'lucide-react';
import { api } from '../api';
import { TopPickCategory, Restaurant } from '../types';
import { processInstagramCategory } from '../lib/instagramProcessing';
import { useStore } from '../store/useStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  category: TopPickCategory;
  restaurants: Restaurant[];
}

export type InstagramTheme = 'light' | 'dark' | 'gold';

export default function CategoryInstagramPreviewModal({ isOpen, onClose, category, restaurants }: Props) {
  const { editMode } = useStore();
  const [captionText, setCaptionText] = useState(`Top Picks: ${category?.name} 🏆\n\nCurated by Sobo.ite\n\n#Soboite #TopPicks #FoodRecommendations`);
  const [isPublishing, setIsPublishing] = useState(false);
  const [theme, setTheme] = useState<InstagramTheme>('light');
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Custom Options
  const [customBgUrl, setCustomBgUrl] = useState<string | null>(null);
  const [topText, setTopText] = useState("TOP 3");
  const [categoryText, setCategoryText] = useState(category?.name || "");
  const [subText, setSubText] = useState("in South Mumbai");

  useEffect(() => {
    if (isOpen && category && restaurants) {
      setIsGenerating(true);
      processInstagramCategory(category.name, restaurants, theme, {
        backgroundUrl: customBgUrl,
        topText,
        categoryText,
        subText
      })
        .then(url => {
          setDataUrl(url);
          setIsGenerating(false);
        })
        .catch(err => {
          console.error('Failed to generate image:', err);
          setIsGenerating(false);
        });
    }
  }, [isOpen, category, restaurants, theme, customBgUrl, topText, categoryText, subText]);

  if (!isOpen || !category) return null;

  const handleCustomBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomBgUrl(url);
    }
  };

  const handleDownload = async () => {
    let finalUrl = dataUrl;
    
    if (!finalUrl) return;
    const link = document.createElement('a');
    link.href = finalUrl;
    link.download = `top-picks-${category.name.replace(/\s+/g, '-').toLowerCase()}-${theme}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePublish = async () => {
    if (!editMode) {
      alert('Admin login required to publish to Instagram.');
      return;
    }
    let finalUrl = dataUrl;

    if (!finalUrl) return;
    setIsPublishing(true);
    try {
      await api.publishTopPickToInstagram({
        imageUrl: finalUrl,
        caption: captionText
      });
      onClose();
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Failed to publish.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 md:p-4">
      <div className="bg-white md:rounded-xl shadow-2xl w-full h-full md:h-[90vh] md:max-w-5xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-white shrink-0">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Camera className="h-6 w-6 text-pink-600" />
              Instagram Publish Review
            </h2>
            <p className="text-sm text-gray-500">Category: {category.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col overflow-y-auto bg-gray-50">
          {/* Top: Image Preview */}
          <div className="w-full p-4 flex flex-col items-center border-b border-gray-200 bg-gray-100 relative shrink-0">
            <div className="w-full flex justify-between items-center mb-4 gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Preview & Layout</h3>
              
              <div className="flex gap-2">
                <div className="flex bg-gray-200 rounded-lg p-1">
                  <button 
                    onClick={() => setTheme('light')} 
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1 transition-colors ${theme === 'light' ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-gray-900'}`}
                  >
                    <Sun className="w-3 h-3" /> Light
                  </button>
                  <button 
                    onClick={() => setTheme('dark')} 
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1 transition-colors ${theme === 'dark' ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-gray-900'}`}
                  >
                    <Moon className="w-3 h-3" /> Dark
                  </button>
                  <button 
                    onClick={() => setTheme('gold')} 
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1 transition-colors ${theme === 'gold' ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-gray-900'}`}
                  >
                    <LayoutGrid className="w-3 h-3" /> Gold
                  </button>
                </div>
                
                <div className="flex gap-1">
                  <label className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors cursor-pointer border ${customBgUrl ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                    <Upload className="w-3 h-3" /> {customBgUrl ? 'Custom Bg Active' : 'Upload Bg'}
                    <input type="file" className="hidden" accept="image/*" onChange={handleCustomBackgroundUpload} />
                  </label>
                  {customBgUrl && (
                    <button onClick={() => setCustomBgUrl(null)} className="px-2 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="w-full max-w-sm mb-4 flex flex-col gap-2 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
              <h4 className="text-xs font-semibold text-gray-700 uppercase flex items-center gap-1"><Settings className="w-3 h-3" /> Custom Text</h4>
              <input type="text" value={topText} onChange={(e) => setTopText(e.target.value)} placeholder="Top Text (e.g. TOP 3)" className="text-xs border-gray-300 rounded p-1.5 focus:ring-indigo-500 w-full" />
              <input type="text" value={categoryText} onChange={(e) => setCategoryText(e.target.value)} placeholder="Category Title" className="text-xs border-gray-300 rounded p-1.5 focus:ring-indigo-500 w-full" />
              <input type="text" value={subText} onChange={(e) => setSubText(e.target.value)} placeholder="Subtitle (e.g. in South Mumbai)" className="text-xs border-gray-300 rounded p-1.5 focus:ring-indigo-500 w-full" />
            </div>

            <div className="w-full max-w-sm bg-white rounded-lg shadow-md flex justify-center items-center relative overflow-hidden" style={{ aspectRatio: '4/5', maxHeight: '550px' }}>
              {isGenerating ? (
                <div className="flex flex-col items-center gap-2 text-gray-400 absolute inset-0 bg-white bg-opacity-80 z-10 justify-center">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <span className="text-sm">Applying Theme...</span>
                </div>
              ) : null}
              
              {dataUrl && <img src={dataUrl} alt="Category Top Picks" className="w-full h-full object-contain" />}
            </div>
          </div>

          {/* Bottom: Caption Edit */}
          <div className="w-full p-6 flex flex-col bg-white shrink-0">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wider flex justify-between items-center">
              <span>Edit Caption</span>
              <button
                type="button"
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded"
                onClick={() => navigator.clipboard.writeText(captionText)}
              >
                Copy
              </button>
            </h3>
            <textarea
              className="flex-1 w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none text-base leading-relaxed min-h-[200px] md:min-h-0"
              value={captionText}
              onChange={(e) => setCaptionText(e.target.value)}
              placeholder="Your Instagram caption..."
            ></textarea>
            
            <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm text-blue-800 border border-blue-100">
              <p className="font-semibold mb-1">Tips for a good caption:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Include emojis for better engagement.</li>
                <li>Tag the restaurants you included.</li>
                <li>Ask your audience what they think!</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-white shrink-0 flex justify-end gap-3">
          <button
            onClick={handleDownload}
            disabled={!dataUrl || isGenerating}
            className="px-5 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download
          </button>
          {editMode && (
            <button
              onClick={handlePublish}
              disabled={isPublishing || !dataUrl || isGenerating}
              className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-md hover:shadow-lg"
            >
              {isPublishing ? 'Publishing...' : <><Share2 className="w-4 h-4" /> Approve & Publish</>}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
