
    // Collection functions
    createCollectionBtn.addEventListener('click', async () => {
        const name = collectionNameInput.value.trim();
        const description = collectionDescriptionInput.value.trim();

        if (!name) {
            alert('Collection name cannot be empty.');
            return;
        }

        try {
            const userResponse = await fetch('http://localhost:8000/api/user');
            if (!userResponse.ok) {
                alert('Please log in to create a collection.');
                return;
            }
            const userData = await userResponse.json();
            const userId = userData.login || userData.username;

            const response = await fetch('http://localhost:8000/api/collections', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: userId,
                    name: name,
                    description: description
                }),
            });

            if (response.ok) {
                alert('Collection created successfully!');
                collectionNameInput.value = '';
                collectionDescriptionInput.value = '';
                fetchUserCollections(); // Refresh the list of collections
            } else {
                console.error('Error creating collection:', response.status);
                alert('Failed to create collection.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while creating the collection.');
        }
    });

    async function fetchUserCollections() {
        try {
            const userResponse = await fetch('http://localhost:8000/api/user');
            if (!userResponse.ok) {
                userCollectionsList.innerHTML = '<p>Please log in to view your collections.</p>';
                return;
            }
            const userData = await userResponse.json();
            const userId = userData.login || userData.username;

            const response = await fetch('http://localhost:8000/api/collections');
            if (response.ok) {
                const collections = await response.json();
                renderUserCollections(collections);
            } else {
                console.error('Error fetching collections:', response.status);
                userCollectionsList.innerHTML = '<p>Error loading collections.</p>';
            }
        } catch (error) {
            console.error('Error:', error);
            userCollectionsList.innerHTML = '<p>Error loading collections.</p>';
        }
    }

    function renderUserCollections(collections) {
        userCollectionsList.innerHTML = '';
        if (collections.length === 0) {
            userCollectionsList.innerHTML = '<p>No collections created yet.</p>';
            return;
        }
        collections.forEach(collection => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <h4>${collection.name}</h4>
                <p>${collection.description || 'No description.'}</p>
                <p>Snapshots: ${collection.snapshots.length}</p>
                <button class="view-collection-btn" data-collection-id="${collection.id}">View Collection</button>
            `;
            userCollectionsList.appendChild(listItem);
        });

        userCollectionsList.querySelectorAll('.view-collection-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const collectionId = event.target.dataset.collectionId;
                // Implement viewing collection details (e.g., in a modal or new page)
                alert(`Viewing collection: ${collectionId}`);
            });
        });
    }

    saveSnapshotBtn.addEventListener('click', async () => {
        if (!currentGlyphData) {
            alert('Generate a glyph first before saving a snapshot.');
            return;
        }

        const snapshotName = snapshotNameInput.value.trim();
        const snapshotDescription = snapshotDescriptionInput.value.trim();

        if (!snapshotName) {
            alert('Snapshot name cannot be empty.');
            return;
        }

        try {
            const userResponse = await fetch('http://localhost:8000/api/user');
            if (!userResponse.ok) {
                alert('Please log in to save a snapshot.');
                return;
            }
            const userData = await userResponse.json();
            const userId = userData.login || userData.username;

            const selectedRepo = repoSelect.value;
            const [provider, owner, repoFullName] = selectedRepo.split('/');

            const snapshotData = {
                user_id: userId,
                repository_full_name: `${owner}/${repoFullName}`,
                provider: provider,
                name: snapshotName,
                description: snapshotDescription,
                config: { // Example config, expand as needed
                    theme: currentGlyphData.theme,
                    // other glyph generation parameters
                },
                last_commit_sha: currentGlyphData.last_commit_sha
            };

            const response = await fetch('http://localhost:8000/api/snapshots', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(snapshotData),
            });

            if (response.ok) {
                const result = await response.json();
                alert(`Glyph snapshot saved successfully! Snapshot ID: ${result.snapshot_id}`);
                snapshotNameInput.value = '';
                snapshotDescriptionInput.value = '';
                // Optionally, refresh snapshots list or offer to add to collection
                showAddToCollectionModal(result.snapshot_id);
            } else {
                console.error('Error saving snapshot:', response.status);
                alert('Failed to save glyph snapshot.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while saving the snapshot.');
        }
    });

    function showAddToCollectionModal(snapshotId) {
        addToCollectionModal.style.display = 'block';
        collectionsDropdown.innerHTML = ''; // Clear previous options
        collectionsDropdown.setAttribute('data-current-snapshot-id', snapshotId);

        fetch('http://localhost:8000/api/collections')
            .then(response => response.json())
            .then(collections => {
                if (collections.length === 0) {
                    collectionsDropdown.innerHTML = '<option value="">No collections available</option>';
                    collectionsDropdown.disabled = true;
                    addSnapshotToSelectedCollectionBtn.disabled = true;
                } else {
                    collections.forEach(collection => {
                        const option = document.createElement('option');
                        option.value = collection.id;
                        option.textContent = collection.name;
                        collectionsDropdown.appendChild(option);
                    });
                    collectionsDropdown.disabled = false;
                    addSnapshotToSelectedCollectionBtn.disabled = false;
                }
            })
            .catch(error => {
                console.error('Error fetching collections for modal:', error);
                collectionsDropdown.innerHTML = '<option value="">Error loading collections</option>';
                collectionsDropdown.disabled = true;
                addSnapshotToSelectedCollectionBtn.disabled = true;
            });
    }

    closeCollectionModalBtn.addEventListener('click', () => {
        addToCollectionModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target == addToCollectionModal) {
            addToCollectionModal.style.display = 'none';
        }
    });

    addSnapshotToSelectedCollectionBtn.addEventListener('click', async () => {
        const collectionId = collectionsDropdown.value;
        const snapshotId = collectionsDropdown.getAttribute('data-current-snapshot-id');

        if (!collectionId || !snapshotId) {
            alert('Please select a collection and ensure a snapshot is available.');
            return;
        }

        try {
            // Fetch the existing collection to update its snapshots array
            const collectionResponse = await fetch(`http://localhost:8000/api/collections/${collectionId}`);
            if (!collectionResponse.ok) {
                throw new Error('Collection not found.');
            }
            const collection = await collectionResponse.json();

            // Add snapshotId if not already present
            if (!collection.snapshots.includes(snapshotId)) {
                collection.snapshots.push(snapshotId);
            }

            const updateResponse = await fetch(`http://localhost:8000/api/collections/${collectionId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(collection), // Send the updated collection object
            });

            if (updateResponse.ok) {
                alert('Snapshot added to collection successfully!');
                addToCollectionModal.style.display = 'none';
                fetchUserCollections(); // Refresh collections list
            } else {
                console.error('Error updating collection:', updateResponse.status);
                alert('Failed to add snapshot to collection.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while adding snapshot to collection.');
        }
    });
