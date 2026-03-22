"""
dataset_routes.py
-----------------
Endpoints for uploading and retrieving CSV datasets.
"""
from __future__ import annotations

import io
import logging
import os
import uuid
from typing import Optional

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from backend.database.database import get_db
from backend.market_data.csv_dataset_loader import load_dataset_candles, load_dataset_summary
from backend.market_data.dataset_normalizer import get_dataset_csv_path, normalize_dataset_dataframe
from backend.services.backtest_service import sync_dataset_record, sync_datasets_from_disk

router = APIRouter(tags=["datasets"])
DATASETS_DIR = os.path.join(os.path.dirname(__file__), "..", "datasets")
os.makedirs(DATASETS_DIR, exist_ok=True)
logger = logging.getLogger(__name__)


@router.post("/datasets/upload")
@router.post("/upload-dataset")
async def upload_dataset(file: UploadFile = File(...), db: Session = Depends(get_db)):
    filename = file.filename or ""
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed.")

    dataset_id = str(uuid.uuid4())
    csv_path = get_dataset_csv_path(dataset_id, DATASETS_DIR)
    csv_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded CSV file is empty.")

        try:
            raw_df = pd.read_csv(io.BytesIO(content))
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"CSV parsing failed: {str(exc)}")

        normalized_df = normalize_dataset_dataframe(raw_df)
        normalized_df.to_csv(csv_path, index=False)

        dataset = sync_dataset_record(db, dataset_id, filename=filename)
        db.commit()

        logger.info("Dataset uploaded dataset_id=%s filename=%s rows=%s", dataset_id, filename, len(normalized_df))
        return {
            "id": dataset.id,
            "dataset_id": dataset.id,
            "filename": dataset.filename,
            "rows": int(len(normalized_df)),
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Dataset upload failed dataset_id=%s filename=%s error=%s", dataset_id, filename, exc)
        raise HTTPException(status_code=500, detail=f"CSV upload failed: {str(exc)}")


@router.get("/dataset/{dataset_id}")
def get_dataset(dataset_id: str, db: Session = Depends(get_db)):
    try:
        summary = load_dataset_summary(dataset_id, DATASETS_DIR)
        dataset = sync_dataset_record(db, dataset_id)
        db.commit()
        return {
            **summary,
            "filename": dataset.filename,
            "symbol": dataset.symbol,
            "created_at": dataset.created_at.isoformat() if dataset.created_at else None,
        }
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Dataset summary failed dataset_id=%s error=%s", dataset_id, exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/dataset/{dataset_id}/candles")
def get_dataset_candles(
    dataset_id: str,
    timeframe: Optional[str] = Query("1m"),
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    limit: Optional[int] = Query(None),
):
    try:
        return load_dataset_candles(
            dataset_id,
            DATASETS_DIR,
            timeframe=timeframe or "1m",
            start=start,
            end=end,
            limit=limit,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Dataset candle load failed dataset_id=%s error=%s", dataset_id, exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/datasets")
def list_datasets(db: Session = Depends(get_db)):
    try:
        datasets = sync_datasets_from_disk(db)
        return [
            {
                "id": dataset.id,
                "dataset_id": dataset.id,
                "filename": dataset.filename,
                "symbol": dataset.symbol,
                "rows": dataset.rows,
                "start": dataset.start.isoformat() if dataset.start else None,
                "end": dataset.end.isoformat() if dataset.end else None,
                "created_at": dataset.created_at.isoformat() if dataset.created_at else None,
            }
            for dataset in datasets
        ]
    except Exception as exc:
        logger.exception("Dataset list failed error=%s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/dataset/{dataset_id}/{timeframe}")
def get_dataset_timeframe(dataset_id: str, timeframe: str):
    try:
        return load_dataset_candles(dataset_id, DATASETS_DIR, timeframe=timeframe)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Dataset timeframe load failed dataset_id=%s timeframe=%s error=%s", dataset_id, timeframe, exc)
        raise HTTPException(status_code=500, detail=str(exc))
