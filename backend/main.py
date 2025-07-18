
@app.post("/api/collections")
async def create_glyph_collection(request: Request, collection: GlyphCollection):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_id = request.session["user_profile"].get("login") if request.session.get("provider") == "github" else request.session["user_profile"].get("username")
    if collection.user_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized to create collection for this user.")

    collection.id = str(uuid.uuid4())
    collection.created_at = datetime.now()
    glyph_collections[collection.id] = collection
    return {"message": "Glyph collection created successfully", "collection_id": collection.id}

@app.get("/api/collections")
async def list_glyph_collections(request: Request):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_id = request.session["user_profile"].get("login") if request.session.get("provider") == "github" else request.session["user_profile"].get("username")
    
    user_collections = [c for c in glyph_collections.values() if c.user_id == user_id]
    return user_collections

@app.get("/api/collections/{collection_id}")
async def get_glyph_collection(collection_id: str, request: Request):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    collection = glyph_collections.get(collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Glyph collection not found")
    
    user_id = request.session["user_profile"].get("login") if request.session.get("provider") == "github" else request.session["user_profile"].get("username")
    if collection.user_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized to access this collection.")
    
    return collection

@app.put("/api/collections/{collection_id}")
async def update_glyph_collection(collection_id: str, request: Request, updated_collection: GlyphCollection):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    existing_collection = glyph_collections.get(collection_id)
    if not existing_collection:
        raise HTTPException(status_code=404, detail="Glyph collection not found")
    
    user_id = request.session["user_profile"].get("login") if request.session.get("provider") == "github" else request.session["user_profile"].get("username")
    if existing_collection.user_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized to update this collection.")
    
    # Update fields that are allowed to be updated
    existing_collection.name = updated_collection.name
    existing_collection.description = updated_collection.description
    existing_collection.snapshots = updated_collection.snapshots # This allows adding/removing snapshots
    
    glyph_collections[collection_id] = existing_collection # Update in storage
    
    return {"message": "Glyph collection updated successfully", "collection": existing_collection}
