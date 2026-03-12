// Global object to store markdown content for each day
const tripDataByDay = {};

/**
 * Loads the content for a specific day into the content area.
 * @param {string} dayId - The identifier for the day (e.g., 'day1').
 */
function loadDay(dayId) {
    const contentDiv = document.getElementById('content');
    const markdownForDay = tripDataByDay[dayId];

    if (markdownForDay) {
        // Use the marked library to convert markdown to HTML
        contentDiv.innerHTML = marked.parse(markdownForDay);
        // Save the currently viewed day to localStorage
        localStorage.setItem('lastViewedDay', dayId);
    } else {
        contentDiv.innerHTML = `<p>找不到 ${dayId} 的內容。</p>`;
    }

    // Highlight the active button
    const dayMenu = document.querySelector('.day-menu');
    const buttons = dayMenu.querySelectorAll('button');
    buttons.forEach(button => button.classList.toggle('active', button.id === dayId));
}

/**
 * Parses all day data and displays a summary list of accommodations.
 */
function showAccommodations() {
    // Manage view visibility and active buttons
    document.querySelector('.day-menu').style.display = 'none';
    document.getElementById('show-itinerary-btn').classList.remove('active');
    document.getElementById('show-accommodation-btn').classList.add('active');

    const contentDiv = document.getElementById('content');
    let accommodationListHtml = '<h2>住宿總覽</h2><table><thead><tr><th>天數</th><th>日期</th><th>住宿</th></tr></thead><tbody>';

    // Sort days numerically to ensure correct order
    const sortedDayIds = Object.keys(tripDataByDay).sort((a, b) => {
        return parseInt(a.replace('day', '')) - parseInt(b.replace('day', ''));
    });

    for (const dayId of sortedDayIds) {
        const markdown = tripDataByDay[dayId];
        if (!markdown) continue;

        const titleLine = markdown.split('\n')[0];
        // 使用更靈活的正規表示式，忽略圖示並同時處理全形與半形的冒號。
        const accommodationMatch = markdown.match(/住宿[:：]\s*(.*)/);

        // If an accommodation is found for the day, extract details
        if (accommodationMatch) {
            const dayInfoMatch = titleLine.match(/D(\d+)\s*｜\s*(\d{1,2}\/\d{1,2}（.）)\s*([^→\n]*)/);
            if (dayInfoMatch) {
                const [, dayNumber, date] = dayInfoMatch;
                // 清理抓取到的文字：移除結尾可能存在的 Markdown 粗體符號 ('**')
                let accommodation = accommodationMatch[1].trim().replace(/\*\*$/, '');
                // Format to: D1 ,11/30（六）神戶 Daiwa Roynet Hotel 神戶三宮 PREMIER
                accommodationListHtml += `<tr data-day-id="${dayId}">
                    <td>D${dayNumber}</td>
                    <td>${date}</td>
                    <td>${accommodation}</td>
                </tr>`;
            }
        }
    }

    accommodationListHtml += '</tbody></table>';
    contentDiv.innerHTML = accommodationListHtml;

    // Add event listener to the table for row clicks
    const table = contentDiv.querySelector('table');
    if (table) {
        table.addEventListener('click', (event) => {
            const row = event.target.closest('tr');
            // Ensure the click is on a row with a day ID and not the header
            if (row && row.dataset.dayId) {
                showItineraryView(row.dataset.dayId);
            }
        });
    }
}

/**
 * Searches for a keyword in the trip data and displays results.
 */
function performSearch() {
    const searchInput = document.getElementById('search-input');
    const keyword = searchInput.value.trim().toLowerCase();

    if (!keyword) {
        alert('請輸入搜尋關鍵字');
        return;
    }

    // Manage view visibility
    document.querySelector('.day-menu').style.display = 'none';
    document.querySelectorAll('.top-menu button').forEach(btn => btn.classList.remove('active'));

    const contentDiv = document.getElementById('content');
    let resultsHtml = `<h2>搜尋結果: "${keyword}"</h2><ul class="search-results">`;
    let foundCount = 0;

    // Sort days
    const sortedDayIds = Object.keys(tripDataByDay).sort((a, b) => {
        return parseInt(a.replace('day', '')) - parseInt(b.replace('day', ''));
    });

    for (const dayId of sortedDayIds) {
        const markdown = tripDataByDay[dayId];
        if (markdown.toLowerCase().includes(keyword)) {
            foundCount++;
            const titleLine = markdown.split('\n')[0].replace(/^#+\s*/, ''); // Remove heading markers
            
            // Find lines containing the keyword for context
            const lines = markdown.split('\n');
            let matchesHtml = '';
            lines.forEach(line => {
                if (line.toLowerCase().includes(keyword)) {
                    // Clean up markdown formatting for display
                    const cleanLine = line.replace(/^[#\-* ]+/, '').trim();
                    matchesHtml += `<div style="color: #666; font-size: 0.9em; margin-top: 4px;">... ${cleanLine} ...</div>`;
                }
            });

            resultsHtml += `<li data-day-id="${dayId}" style="margin-bottom: 15px; cursor: pointer; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                <div style="font-weight: bold; color: #007bff; font-size: 1.1em;">${titleLine}</div>
                ${matchesHtml}
            </li>`;
        }
    }

    if (foundCount === 0) {
        resultsHtml += '<p>找不到符合的行程內容。</p>';
    }

    resultsHtml += '</ul>';
    contentDiv.innerHTML = resultsHtml;

    // Add click listeners to results to jump to the itinerary
    const resultItems = contentDiv.querySelectorAll('li[data-day-id]');
    resultItems.forEach(item => {
        item.addEventListener('click', () => {
            showItineraryView(item.dataset.dayId);
        });
    });
}

/**
 * Switches the view back to the day-by-day itinerary.
 */
function showItineraryView(dayIdToLoad = null) {
    // Manage view visibility and active buttons
    document.querySelector('.day-menu').style.display = 'flex';
    document.getElementById('show-accommodation-btn').classList.remove('active');
    document.getElementById('show-itinerary-btn').classList.add('active');

    // Load the relevant day's content
    let dayToLoad = dayIdToLoad;
    if (!dayToLoad) {
        const lastViewedDay = localStorage.getItem('lastViewedDay');
        if (lastViewedDay && tripDataByDay[lastViewedDay]) {
            dayToLoad = lastViewedDay;
        } else if (Object.keys(tripDataByDay).length > 0) {
            dayToLoad = 'day1';
        }
    }

    if (dayToLoad) {
        loadDay(dayToLoad);
    } else {
        document.getElementById('content').innerHTML = '';
    }
}

/**
 * Fetches the trip markdown file, parses it into daily sections,
 * and dynamically creates navigation buttons for each day.
 */
async function initializeTrip() {
    try {
        const response = await fetch('tripAll_2024.md');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const markdownText = await response.text();

        // Split the text by day sections using a positive lookahead and multiline flag.
        // This looks for lines starting with "##" that contain "D" followed by a number.
        const daySections = markdownText.split(/(?=^## .*D\d+)/m);

        // The first element is the main title; we skip it.
        const dayContentSections = daySections.slice(1);

        const dayMenu = document.querySelector('.day-menu');
        dayMenu.innerHTML = ''; // Clear any hardcoded buttons

        dayContentSections.forEach(section => {
            // Extract the day number (e.g., "1", "2") from the section header
            const match = section.match(/D(\d+)/);
            if (match) {
                const dayNumber = match[1];
                const dayId = `day${dayNumber}`;
                tripDataByDay[dayId] = section.trim(); // Store the trimmed markdown

                // Create a button for this day
                const button = document.createElement('button');
                button.textContent = `Day ${dayNumber}`;
                button.id = dayId; // Assign an ID for easy selection later
                button.onclick = () => loadDay(dayId);
                dayMenu.appendChild(button);
            }
        });

        // Set the initial view to the itinerary
        showItineraryView();

    } catch (error) {
        console.error('Error loading or parsing markdown:', error);
        document.getElementById('content').innerHTML = '<p>無法載入行程資料，請檢查主控台的錯誤訊息。</p>';
    }
}

// Add a style for the active button to give visual feedback
const style = document.createElement('style');
style.textContent = ` .day-menu button.active, .top-menu button.active {
        background-color: #007bff;
        color: white;
        border-color: #007bff;
    }
    table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
    }
    th, td {
        border: 1px solid #ddd;
        padding: 8px;
        text-align: left;
    }
    th {
        background-color: #f2f2f2;
    }
    tr:nth-child(even) {
        background-color: #f9f9f9;
    }
    tbody tr:hover {
        background-color: #e9e9e9;
        cursor: pointer;
    }
`;
document.head.appendChild(style);


// Start the initialization process once the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Attach listeners to the main navigation buttons
    document.getElementById('show-itinerary-btn').addEventListener('click', () => showItineraryView());
    document.getElementById('show-accommodation-btn').addEventListener('click', showAccommodations);
    
    // Attach listeners for search
    document.getElementById('search-btn').addEventListener('click', performSearch);
    document.getElementById('search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });

    // Load the main trip data and set up the page
    initializeTrip();
});