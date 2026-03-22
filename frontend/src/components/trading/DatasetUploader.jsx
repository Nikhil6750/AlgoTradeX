import { useCallback, useMemo, useRef, useState } from "react";
import { CheckCircle, UploadCloud } from "lucide-react";
import toast from "react-hot-toast";

import StatusMessageCard from "../ui/StatusMessageCard";
import { apiPostForm, buildApiErrorState } from "../../lib/api";

const UPLOAD_TIMEOUT_MS = 15000;

export default function DatasetUploader({
  onUploadSuccess,
  appearance = "default",
  showSuccessToast = true,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [datasetInfo, setDatasetInfo] = useState(null);
  const [errorState, setErrorState] = useState(null);
  const [lastFile, setLastFile] = useState(null);
  const inputRef = useRef(null);
  const isMonochrome = appearance === "monochrome";

  const handleDragEvent = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.type === "dragenter" || event.type === "dragover") {
      setIsDragging(true);
    } else if (event.type === "dragleave") {
      setIsDragging(false);
    }
  }, []);

  const notifySuccess = useCallback((payload, file) => {
    const nextDataset = {
      name: file.name,
      rows: payload.rows || 0,
      candles: payload.candles || [],
    };
    setDatasetInfo(nextDataset);
    setErrorState(null);
    onUploadSuccess?.(nextDataset);
    if (showSuccessToast) {
      toast.success("CSV uploaded.");
    }
  }, [onUploadSuccess, showSuccessToast]);

  const handleFileSelect = useCallback(async (file) => {
    if (!file) {
      return;
    }

    setLastFile(file);
    setErrorState(null);
    setUploading(true);

    try {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        throw new Error("Only CSV files are allowed.");
      }

      const text = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file.slice(0, 1024));
      });
      
      const firstRowData = text.split('\n')[0].toLowerCase();
      
      if (!firstRowData.includes('open') || !firstRowData.includes('high') || !firstRowData.includes('low') || !firstRowData.includes('close')) {
        window.alert("Invalid CSV. Upload trading data only.");
        setUploading(false);
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      const response = await apiPostForm("/upload-csv", formData, {
        timeout: UPLOAD_TIMEOUT_MS,
      });

      if (response && response.rows !== undefined) {
          notifySuccess(response, file);
      } else {
        throw new Error("Upload completed, but the response was invalid.");
      }
    } catch (error) {
      setErrorState(buildApiErrorState(error, "Upload failed", "Failed to save CSV dataset."));
      console.error(error);
    } finally {
      setUploading(false);
    }
  }, [notifySuccess]);

  const handleDrop = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (file) {
      void handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const retryUpload = useCallback(() => {
    if (lastFile) {
      void handleFileSelect(lastFile);
    }
  }, [handleFileSelect, lastFile]);

  const handleReset = useCallback(() => {
    setDatasetInfo(null);
    setErrorState(null);
    setLastFile(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    onUploadSuccess?.(null);
  }, [onUploadSuccess]);

  const errorCard = useMemo(() => {
    if (!errorState) {
      return null;
    }

    return (
      <StatusMessageCard
        title={errorState.title}
        description={errorState.description}
        actionLabel="Retry Upload"
        onAction={retryUpload}
        tone="neutral"
      />
    );
  }, [errorState, retryUpload]);

  if (datasetInfo) {
    return (
      <div className="space-y-3">
        <div className="group relative rounded-2xl border border-[#222222] bg-[#111111] p-4">
          <button
            type="button"
            onClick={handleReset}
            className="absolute right-3 top-3 text-sm text-[#a0a0a0] opacity-0 transition group-hover:opacity-100 hover:text-white"
            title="Remove dataset"
          >
            ×
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#222222] bg-black text-white">
              <CheckCircle size={16} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{datasetInfo.name}</p>
              <p className="text-xs text-[#a0a0a0]">{datasetInfo.rows.toLocaleString()} rows</p>
            </div>
          </div>
        </div>
        {errorCard}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {errorCard}
      <div
        onDragEnter={handleDragEvent}
        onDragLeave={handleDragEvent}
        onDragOver={handleDragEvent}
        onDrop={handleDrop}
        className={`rounded-2xl border-2 border-dashed p-6 transition ${
          isDragging
            ? "border-white bg-[#111111]"
            : isMonochrome
              ? "border-[#222222] bg-[#111111]"
              : "border-[#222222] bg-[#111111]"
        } ${uploading ? "pointer-events-none opacity-60" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          id="dataset-upload"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) {
              void handleFileSelect(file);
            }
          }}
        />

        <label htmlFor="dataset-upload" className="flex cursor-pointer flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#222222] bg-black text-white">
            {uploading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            ) : (
              <UploadCloud size={20} />
            )}
          </div>
          <span className="text-sm font-semibold text-white">
            {uploading ? "Uploading CSV..." : "Upload CSV"}
          </span>
          <span className="text-xs text-[#a0a0a0]">
            Required columns: timestamp, open, high, low, close
          </span>
        </label>
      </div>
    </div>
  );
}
