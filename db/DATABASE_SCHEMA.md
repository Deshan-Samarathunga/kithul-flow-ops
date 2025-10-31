# Kithul Flow Ops - Database Schema Relationships

This document illustrates how all database tables connect and the data flow through the system.

## Business Flow Overview

```
Field Collection → Processing → Packaging → Labeling
```

**Two distinct production flows:**
1. **Sap → Treacle (In-house)**: SAP collected → Processed to Treacle → Packaged → Labeled
2. **Treacle → Jaggery**: Treacle (third-party) collected → Processed to Jaggery → Packaged → Labeled

---

## Entity Relationship Diagram

```
┌─────────────────────┐
│      users          │
│─────────────────────│
│ id (PK)             │
│ user_id (UNIQUE)    │
│ name                │
│ role                │
└─────────────────────┘
         │
         │ (created_by)
         │
         ├─────────────────────────────────────┐
         │                                     │
         ▼                                     ▼
┌─────────────────────┐           ┌─────────────────────┐
│ collection_centers   │           │ treacle_processing_ │
│─────────────────────│           │   batches            │
│ id (PK)             │           │─────────────────────│
│ center_id (UNIQUE)  │           │ id (PK)             │
│ center_name         │           │ batch_id (UNIQUE)   │
│ location            │           │ product_type="treacle"│
│ is_active           │           │ created_by (FK)     │
└─────────────────────┘           └─────────────────────┘
         │                                    │
         │                                    │ (produces)
         │                                    │
         │                                    ▼
         │                          ┌─────────────────────┐
         │                          │ treacle_packaging_  │
         │                          │   batches           │
         │                          │─────────────────────│
         │                          │ id (PK)             │
         │                          │ packaging_id        │
│                          │ processing_batch_id │
│                          │   (FK→treacle_processing)│
│                          └─────────────────────┘
         │                                    │
         │                                    │ (labeled)
         │                                    │
         │                                    ▼
         │                          ┌─────────────────────┐
         │                          │ treacle_labeling_   │
         │                          │   batches           │
         │                          │─────────────────────│
         │                          │ id (PK)             │
         │                          │ labeling_id         │
         │                          │ packaging_batch_id │
         │                          │   (FK→treacle_packaging)│
         │                          └─────────────────────┘
         │
         │ (collects from)
         │
         ▼
┌─────────────────────┐
│ field_collection_   │
│   drafts            │
│─────────────────────│
│ id (PK)             │
│ draft_id (UNIQUE)   │
│ date                │
│ status              │
│ created_by (FK)     │
└─────────────────────┘
         │
         │ (contains)
         │
         ├──────────────────────┐
         │                      │
         ▼                      ▼
┌─────────────────────┐  ┌─────────────────────┐
│ sap_cans            │  │ treacle_cans         │
│─────────────────────│  │─────────────────────│
│ id (PK)             │  │ id (PK)             │
│ can_id (UNIQUE)     │  │ can_id (UNIQUE)     │
│ draft_id (FK)       │  │ draft_id (FK)       │
│ collection_center_  │  │ collection_center_    │
│   id (FK)           │  │   id (FK)           │
│ product_type="sap"  │  │ product_type="treacle"│
│ quantity            │  │ quantity            │
└─────────────────────┘  └─────────────────────┘
         │                      │
         │                      │
         │ (assigned to)        │ (assigned to)
         │                      │
         ▼                      ▼
┌─────────────────────┐  ┌─────────────────────┐
│ treacle_processing_ │  │ jaggery_processing_ │
│   batch_cans        │  │   batch_cans        │
│─────────────────────│  │─────────────────────│
│ id (PK)             │  │ id (PK)             │
│ processing_batch_id  │  │ processing_batch_id  │
│   (FK)              │  │   (FK)              │
│ can_id (FK)         │  │ can_id (FK)         │
└─────────────────────┘  └─────────────────────┘
         │                      │
         │                      │
         │ (belongs to)         │ (belongs to)
         │                      │
         ▼                      ▼
┌─────────────────────┐  ┌─────────────────────┐
│ treacle_processing_ │  │ jaggery_processing_ │
│   batches           │  │   batches           │
│─────────────────────│  │─────────────────────│
│ id (PK)             │  │ id (PK)             │
│ batch_id (UNIQUE)   │  │ batch_id (UNIQUE)   │
│ product_type=       │  │ product_type=       │
│   "treacle"         │  │   "jaggery"        │
│ created_by (FK)     │  │ created_by (FK)     │
└─────────────────────┘  └─────────────────────┘
         │                      │
         │                      │
         │ (produces)            │ (produces)
         │                      │
         ▼                      ▼
┌─────────────────────┐  ┌─────────────────────┐
│ treacle_packaging_  │  │ jaggery_packaging_  │
│   batches           │  │   batches           │
│─────────────────────│  │─────────────────────│
│ id (PK)             │  │ id (PK)             │
│ packaging_id        │  │ packaging_id        │
│ processing_batch_id │  │ processing_batch_id │
│   (FK→treacle_processing)│  │   (FK→jaggery_processing)│
└─────────────────────┘  └─────────────────────┘
         │                      │
         │                      │
         │ (labeled)            │ (labeled)
         │                      │
         ▼                      ▼
┌─────────────────────┐  ┌─────────────────────┐
│ treacle_labeling_   │  │ jaggery_labeling_   │
│   batches           │  │   batches           │
│─────────────────────│  │─────────────────────│
│ id (PK)             │  │ id (PK)             │
│ labeling_id         │  │ labeling_id         │
│ packaging_batch_id  │  │ packaging_batch_id  │
│   (FK→treacle_packaging)│  │   (FK→jaggery_packaging)│
└─────────────────────┘  └─────────────────────┘

┌─────────────────────┐
│ field_collection_   │
│   center_completions│
│─────────────────────│
│ id (PK)             │
│ draft_id (FK)       │
│ center_id (FK)      │
│ completed_at        │
└─────────────────────┘
```

---

## Detailed Flow Diagrams

### Flow 1: Sap → Treacle (In-house)

```
┌─────────────────────────────────────────────────────────────────────┐
│                          FIELD COLLECTION                           │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Collect raw SAP
                                    ▼
                    ┌───────────────────────────────┐
                    │   field_collection_drafts      │
                    │   (draft_id, date, status)     │
                    └───────────────────────────────┘
                                    │
                                    │ Contains
                                    ▼
                    ┌───────────────────────────────┐
                    │      sap_cans                 │
                    │   (can_id: SAP-########)      │
                    │   product_type: "sap"         │
                    │   collection_center_id →      │
                    │     collection_centers        │
                    └───────────────────────────────┘
                                    │
                                    │ Assigned to
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            PROCESSING                               │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────────────────────┐
                    │ treacle_processing_batch_cans │
                    │   (junction table)            │
                    └───────────────────────────────┘
                                    │
                                    │ Belongs to
                                    ▼
                    ┌───────────────────────────────┐
                    │  treacle_processing_batches    │
                    │   product_type: "treacle" ⭐   │
                    │   (converts SAP → Treacle)     │
                    └───────────────────────────────┘
                                    │
                                    │ Produces
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            PACKAGING                                 │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────────────────────┐
                    │ treacle_packaging_batches     │
                    │   (for in-house treacle)      │
                    │   processing_batch_id →       │
                    │     treacle_processing_batches │
                    └───────────────────────────────┘
                                    │
                                    │ Labeled
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            LABELING                                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────────────────────┐
                    │ treacle_labeling_batches      │
                    │   (for in-house treacle)      │
                    │   packaging_batch_id →        │
                    │     treacle_packaging_batches  │
                    └───────────────────────────────┘
```

### Flow 2: Treacle (Third-party) → Jaggery

```
┌─────────────────────────────────────────────────────────────────────┐
│                          FIELD COLLECTION                           │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Collect third-party Treacle
                                    ▼
                    ┌───────────────────────────────┐
                    │   field_collection_drafts      │
                    │   (shared draft table)         │
                    └───────────────────────────────┘
                                    │
                                    │ Contains
                                    ▼
                    ┌───────────────────────────────┐
                    │    treacle_cans               │
                    │   (can_id: TCL-########)      │
                    │   product_type: "treacle"      │
                    │   collection_center_id →       │
                    │     collection_centers         │
                    └───────────────────────────────┘
                                    │
                                    │ Assigned to
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            PROCESSING                               │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────────────────────┐
                    │jaggery_processing_batch_cans  │
                    │   (junction table)            │
                    └───────────────────────────────┘
                                    │
                                    │ Belongs to
                                    ▼
                    ┌───────────────────────────────┐
                    │ jaggery_processing_batches    │
                    │   product_type: "jaggery" ⭐   │
                    │   (converts Treacle → Jaggery)│
                    └───────────────────────────────┘
                                    │
                                    │ Produces
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            PACKAGING                                 │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────────────────────┐
                    │ jaggery_packaging_batches     │
                    │   processing_batch_id →       │
                    │     jaggery_processing_batches │
                    └───────────────────────────────┘
                                    │
                                    │ Labeled
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            LABELING                                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────────────────────┐
                    │ jaggery_labeling_batches      │
                    │   packaging_batch_id →        │
                    │     jaggery_packaging_batches  │
                    └───────────────────────────────┘
```

---

## Table Relationships Summary

### Foreign Key Relationships

| Parent Table | Child Table | Foreign Key | Relationship |
|--------------|-------------|-------------|--------------|
| `users` | `field_collection_drafts` | `created_by` → `user_id` | One-to-Many |
| `users` | `treacle_processing_batches` | `created_by` → `user_id` | One-to-Many |
| `users` | `jaggery_processing_batches` | `created_by` → `user_id` | One-to-Many |
| `collection_centers` | `sap_cans` | `collection_center_id` → `id` | One-to-Many |
| `collection_centers` | `treacle_cans` | `collection_center_id` → `id` | One-to-Many |
| `collection_centers` | `field_collection_center_completions` | `center_id` → `center_id` | One-to-Many |
| `field_collection_drafts` | `sap_cans` | `draft_id` → `id` | One-to-Many |
| `field_collection_drafts` | `treacle_cans` | `draft_id` → `id` | One-to-Many |
| `field_collection_drafts` | `field_collection_center_completions` | `draft_id` → `draft_id` | One-to-Many |
| `sap_cans` | `treacle_processing_batch_cans` | `can_id` → `id` | One-to-One (UNIQUE) |
| `treacle_processing_batches` | `treacle_processing_batch_cans` | `processing_batch_id` → `id` | One-to-Many |
| `treacle_processing_batches` | `treacle_packaging_batches` | `processing_batch_id` → `id` | One-to-One (UNIQUE) |
| `treacle_cans` | `jaggery_processing_batch_cans` | `can_id` → `id` | One-to-One (UNIQUE) |
| `jaggery_processing_batches` | `jaggery_processing_batch_cans` | `processing_batch_id` → `id` | One-to-Many |
| `jaggery_processing_batches` | `jaggery_packaging_batches` | `processing_batch_id` → `id` | One-to-One (UNIQUE) |
| `treacle_packaging_batches` | `treacle_labeling_batches` | `packaging_batch_id` → `id` | One-to-One (UNIQUE) |
| `jaggery_packaging_batches` | `jaggery_labeling_batches` | `packaging_batch_id` → `id` | One-to-One (UNIQUE) |

---

## Key Business Rules

### Field Collection Stage
- **sap_cans**: Stores raw SAP collected from collection centers
- **treacle_cans**: Stores third-party Treacle purchased from collection centers
- Both share the same `field_collection_drafts` table
- Can IDs format: `SAP-########` for sap, `TCL-########` for treacle

### Processing Stage
- **treacle_processing_batches**: 
  - Takes cans from `sap_cans`
  - Produces **Treacle (in-house)**
  - `product_type` constraint: `'treacle'`
  
- **jaggery_processing_batches**: 
  - Takes cans from `treacle_cans` (third-party)
  - Produces **Jaggery**
  - `product_type` constraint: `'jaggery'`

### Packaging Stage
- **treacle_packaging_batches**: 
  - Links to `treacle_processing_batches` (produces in-house treacle)
  - One packaging batch per processing batch (UNIQUE constraint)

- **jaggery_packaging_batches**: 
  - Links to `jaggery_processing_batches`
  - One packaging batch per processing batch (UNIQUE constraint)

### Labeling Stage
- **treacle_labeling_batches**: 
  - Links to `treacle_packaging_batches`
  - One labeling batch per packaging batch (UNIQUE constraint)

- **jaggery_labeling_batches**: 
  - Links to `jaggery_packaging_batches`
  - One labeling batch per packaging batch (UNIQUE constraint)

---

## Constraints and Limits

1. **Processing Can Limit**: Maximum 15 cans per processing batch (enforced by trigger)
2. **Can Uniqueness**: Each can can only be assigned to one processing batch
3. **One-to-One Relationships**: 
   - Processing → Packaging (1:1)
   - Packaging → Labeling (1:1)
4. **Product Type Constraints**: 
   - `treacle_processing_batches.product_type` must be `'treacle'`
   - `jaggery_processing_batches.product_type` must be `'jaggery'`
   - `sap_cans.product_type` must be `'sap'`
   - `treacle_cans.product_type` must be `'treacle'`

---

## Table Names Reference

| Logical Name | Actual Table Name | Purpose |
|--------------|-------------------|---------|
| Users | `users` | System users and authentication |
| Collection Centers | `collection_centers` | Field collection locations |
| Drafts | `field_collection_drafts` | Field collection drafts (shared) |
| SAP Cans | `sap_cans` | Raw SAP collected |
| Treacle Cans | `treacle_cans` | Third-party Treacle purchased |
| Treacle Processing | `treacle_processing_batches` | Processes SAP → Treacle (in-house) |
| Jaggery Processing | `jaggery_processing_batches` | Processes Treacle → Jaggery |
| Treacle Packaging | `treacle_packaging_batches` | Packages in-house Treacle |
| Jaggery Packaging | `jaggery_packaging_batches` | Packages Jaggery |
| Treacle Labeling | `treacle_labeling_batches` | Labels in-house Treacle |
| Jaggery Labeling | `jaggery_labeling_batches` | Labels Jaggery |
| Center Completions | `field_collection_center_completions` | Tracks center completion status |

---

## Visual Summary

```
                     FIELD COLLECTION
                           │
            ┌──────────────┴──────────────┐
            │                             │
    [sap_cans]                 [treacle_cans]
    (Raw SAP)                  (Third-party Treacle)
            │                             │
            │                             │
    PROCESSING STAGE
            │                             │
    [sap_processing]          [jaggery_processing]
    → Treacle (in-house)      → Jaggery
            │                             │
            │                             │
    PACKAGING STAGE
            │                             │
    [treacle_packaging]       [jaggery_packaging]
            │                             │
            │                             │
    LABELING STAGE
            │                             │
    [treacle_labeling]        [jaggery_labeling]
```

---

## Notes

- ⭐ **Critical**: `treacle_processing_batches` has `product_type = 'treacle'` even though it processes SAP. This is because it produces Treacle (in-house).
- All cans are collected in the Field Collection stage and stored with their original product type (`sap` or `treacle`).
- The product type mapping happens at the processing stage where the output product type is stored.
- Field collection still uses `"sap"` and `"treacle"` as product types (raw materials).
- Processing/Packaging/Labeling use `"treacle"` and `"jaggery"` as product types (finished products).

