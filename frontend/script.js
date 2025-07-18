
    // Get references to new elements
    const notificationEmailInput = document.getElementById('notification-email');
    const saveNotificationSettingsBtn = document.getElementById('save-notification-settings-btn');
    const sendTestDigestBtn = document.getElementById('send-test-digest-btn');

    const structureRepoSelect = document.getElementById('structure-repo');
    const styleRepoSelect = document.getElementById('style-repo');
    const generateMashupBtn = document.getElementById('generate-mashup-btn');
    const mashupGlyphContainer = document.getElementById('mashup-glyph-container');

    const goalCollectionSelect = document.getElementById('goal-collection');
    const goalNameInput = document.getElementById('goal-name');
    const goalDescriptionInput = document.getElementById('goal-description');
    const goalTargetDateInput = document.getElementById('goal-target-date');
    const goalKeywordsInput = document.getElementById('goal-keywords');
    const createGoalBtn = document.getElementById('create-goal-btn');
    const userGoalsList = document.getElementById('user-goals-list');

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
        goalCollectionSelect.innerHTML = ''; // Clear previous options for goals

        if (collections.length === 0) {
            userCollectionsList.innerHTML = '<p>No collections created yet.</p>';
            goalCollectionSelect.innerHTML = '<option value="">No collections available</option>';
            goalCollectionSelect.disabled = true;
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

            // Populate goal collection select
            const option = document.createElement('option');
            option.value = collection.id;
            option.textContent = collection.name;
            goalCollectionSelect.appendChild(option);
        });
        goalCollectionSelect.disabled = false;

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

    // Notification functions
    saveNotificationSettingsBtn.addEventListener('click', async () => {
        const email = notificationEmailInput.value.trim();
        if (!email) {
            alert('Please enter an email address.');
            return;
        }
        // In a real app, you'd associate this email with a user's collection or profile
        // For now, let's assume we update the first collection found for the user.
        try {
            const userCollections = await (await fetch('http://localhost:8000/api/collections')).json();
            if (userCollections.length > 0) {
                const collectionToUpdate = userCollections[0]; // Just taking the first one for simplicity
                collectionToUpdate.user_email = email;
                const response = await fetch(`http://localhost:8000/api/collections/${collectionToUpdate.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(collectionToUpdate)
                });
                if (response.ok) {
                    alert('Notification settings saved!');
                } else {
                    alert('Failed to save notification settings.');
                }
            } else {
                alert('No collections found to save notification settings for.');
            }
        } catch (error) {
            console.error('Error saving notification settings:', error);
            alert('An error occurred while saving settings.');
        }
    });

    sendTestDigestBtn.addEventListener('click', async () => {
        try {
            const userCollections = await (await fetch('http://localhost:8000/api/collections')).json();
            if (userCollections.length > 0) {
                const collectionToSendDigest = userCollections[0]; // Just taking the first one for simplicity
                if (!collectionToSendDigest.user_email) {
                    alert('Please save an email address in notification settings first.');
                    return;
                }
                const response = await fetch(`http://localhost:8000/api/collections/${collectionToSendDigest.id}/send-digest`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                if (response.ok) {
                    alert('Test digest email sent!');
                } else {
                    alert('Failed to send test digest.');
                }
            } else {
                alert('No collections found to send digest for.');
            }
        } catch (error) {
            console.error('Error sending test digest:', error);
            alert('An error occurred while sending the test digest.');
        }
    });

    // Mashup Glyph functions
    // Populate repo selects (dummy data for now)
    const dummyRepos = [
        "github/user1/repoA",
        "github/user1/repoB",
        "github/user2/repoX",
        "github/user2/repoY"
    ];

    function populateRepoSelects() {
        structureRepoSelect.innerHTML = '';
        styleRepoSelect.innerHTML = '';
        dummyRepos.forEach(repo => {
            const option1 = document.createElement('option');
            option1.value = repo;
            option1.textContent = repo;
            structureRepoSelect.appendChild(option1);

            const option2 = document.createElement('option');
            option2.value = repo;
            option2.textContent = repo;
            styleRepoSelect.appendChild(option2);
        });
    }
    populateRepoSelects();

    generateMashupBtn.addEventListener('click', async () => {
        const structureRepo = structureRepoSelect.value;
        const styleRepo = styleRepoSelect.value;

        if (!structureRepo || !styleRepo) {
            alert('Please select both structure and style repositories.');
            return;
        }

        try {
            const response = await fetch('http://localhost:8000/api/mashup-glyph', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    repo_structure_path: structureRepo,
                    repo_style_path: styleRepo
                })
            });

            if (response.ok) {
                const result = await response.json();
                mashupGlyphContainer.innerHTML = result.svg_content;
                alert('Mashup Glyph generated successfully!');
            } else {
                console.error('Error generating mashup glyph:', response.status);
                alert('Failed to generate mashup glyph.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while generating the mashup glyph.');
        }
    });

    // Project Goals functions
    async function fetchUserGoals() {
        try {
            const userResponse = await fetch('http://localhost:8000/api/user');
            if (!userResponse.ok) {
                userGoalsList.innerHTML = '<p>Please log in to view your goals.</p>';
                return;
            }
            const userData = await userResponse.json();
            const userId = userData.login || userData.username;

            // Assuming an endpoint to list goals for a user/collection
            // For simplicity, let's assume we fetch all goals and filter by user_id
            const response = await fetch('http://localhost:8000/api/goals'); // This endpoint needs to be implemented in backend
            if (response.ok) {
                const allGoals = await response.json();
                const userGoals = allGoals.filter(goal => goal.user_id === userId);
                renderUserGoals(userGoals);
            } else {
                console.error('Error fetching goals:', response.status);
                userGoalsList.innerHTML = '<p>Error loading goals.</p>';
            }
        } catch (error) {
            console.error('Error:', error);
            userGoalsList.innerHTML = '<p>Error loading goals.</p>';
        }
    }

    function renderUserGoals(goals) {
        userGoalsList.innerHTML = '';
        if (goals.length === 0) {
            userGoalsList.innerHTML = '<p>No goals created yet.</p>';
            return;
        }
        goals.forEach(goal => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <h4>${goal.name} (Progress: ${(goal.progress * 100).toFixed(0)}%)</h4>
                <p>${goal.description || 'No description.'}</p>
                <p>Target Date: ${goal.target_date ? new Date(goal.target_date).toLocaleDateString() : 'N/A'}</p>
                <p>Keywords: ${goal.keywords.join(', ')}</p>
                <button class="track-progress-btn" data-goal-id="${goal.id}">Track Progress (Dummy)</button>
            `;
            userGoalsList.appendChild(listItem);
        });

        userGoalsList.querySelectorAll('.track-progress-btn').forEach(button => {
            button.addEventListener('click', async (event) => {
                const goalId = event.target.dataset.goalId;
                // Dummy commit messages for tracking progress
                const dummyCommitMessages = [
                    "feat: implemented goal related feature",
                    "fix: bug fix for goal module",
                    "docs: updated documentation for goal"
                ];
                try {
                    const response = await fetch(`http://localhost:8000/api/goals/${goalId}/track-progress`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ commit_messages: dummyCommitMessages })
                    });
                    if (response.ok) {
                        alert('Progress tracked successfully!');
                        fetchUserGoals(); // Refresh goals list
                    } else {
                        alert('Failed to track progress.');
                    }
                } catch (error) {
                    console.error('Error tracking progress:', error);
                    alert('An error occurred while tracking progress.');
                }
            });
        });
    }

    createGoalBtn.addEventListener('click', async () => {
        const collectionId = goalCollectionSelect.value;
        const name = goalNameInput.value.trim();
        const description = goalDescriptionInput.value.trim();
        const targetDate = goalTargetDateInput.value;
        const keywords = goalKeywordsInput.value.split(',').map(k => k.trim()).filter(k => k.length > 0);

        if (!collectionId || !name || !keywords.length) {
            alert('Please fill in all required goal fields (Collection, Name, Keywords).');
            return;
        }

        try {
            const userResponse = await fetch('http://localhost:8000/api/user');
            if (!userResponse.ok) {
                alert('Please log in to create a goal.');
                return;
            }
            const userData = await userResponse.json();
            const userId = userData.login || userData.username;

            const response = await fetch('http://localhost:8000/api/goals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    collection_id: collectionId,
                    user_id: userId,
                    name: name,
                    description: description,
                    target_date: targetDate || null,
                    keywords: keywords
                })
            });

            if (response.ok) {
                alert('Project goal created successfully!');
                goalNameInput.value = '';
                goalDescriptionInput.value = '';
                goalTargetDateInput.value = '';
                goalKeywordsInput.value = '';
                fetchUserGoals(); // Refresh goals list
            } else {
                console.error('Error creating goal:', response.status);
                alert('Failed to create project goal.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while creating the project goal.');
        }
    });

    // Initial fetches on page load
    fetchUserCollections();
    fetchUserGoals();

}); // End DOMContentLoaded
