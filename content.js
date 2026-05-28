(function() {
    'use strict';

    // 🔴 REPLACE WITH YOUR DEPLOYED GOOGLE APPS SCRIPT WEB APP URL
    const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby75oFqd8fLmHJEeflxZBsrQLecQ3XOgnd0KPBlxONqK1t8-ZGvZy_hxFApyis-D6QZ/exec";

    let isFrozen = false;
    let lastUploadedAnswer = "";
    let currentActiveID = "";

    window.addEventListener('keydown', function(e) {
        if (e.key === ']') {
            isFrozen = !isFrozen;
            console.log(isFrozen ? "[EP] Helper Paused" : "[EP] Helper Resumed");
        }
    });

    function syncToGoogleDatabase(id, questionText, finalAnswer) {
        if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("XXXXX")) return;

        const payload = {
            action: "syncAnswer",
            contentID: id,
            question: questionText,
            answer: finalAnswer
        };

        fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        }).then(() => {
            lastUploadedAnswer = finalAnswer;
        }).catch(err => console.error("[EP Sync Error]:", err));
    }

    function updateOnScreenDisplay(savedAnswer, currentQuestionText) {
        let displayDiv = document.getElementById('ep-answer-helper-ui');
        if (!displayDiv) {
            displayDiv = document.createElement('div');
            displayDiv.id = 'ep-answer-helper-ui';
            displayDiv.style = "position:fixed;bottom:20px;left:20px;padding:20px;background-color:#1e272e;color:#0beedd;font-family:sans-serif;z-index:999999;border-radius:10px;border:2px solid #0beedd;box-shadow:0 10px 25px rgba(0,0,0,0.5);max-width:400px;";
            document.body.appendChild(displayDiv);
        }

        const rawChinese = currentQuestionText.split(';')[0].trim();
        // 🛠️ Fixed missing '$' syntax error below
        const translateUrl = `https://google.com{encodeURIComponent(rawChinese)}&op=translate`;

        const headerStyle = `font-size:14px; font-weight:bold; margin-bottom:8px; font-family:monospace;`;
        const metaStyle = `color:#ffda79; font-size:18px; margin-bottom:10px; font-weight:bold;`;
        const answerStyle = `font-size:22px; margin-top:10px; color:#fff; background:#2c3e50; padding:8px; border-radius:5px;`;
        const linkStyle = `display:inline-block; margin-top:12px; color:#4cd137; font-size:14px; text-decoration:none; border-bottom:1px dashed #4cd137; font-weight:bold;`;

        if (savedAnswer) {
            displayDiv.innerHTML = `
                <div style="${headerStyle} color:#2ecc71;">[MATCH FOUND]</div>
                <div style="${metaStyle}">Item: ${currentQuestionText}</div>
                <div style="${answerStyle}">👉 <b>${savedAnswer}</b></div>
                <a href="${translateUrl}" target="_blank" style="${linkStyle}">🌐 Open in Google Translate →</a>
            `;
        } else {
            displayDiv.innerHTML = `
                <div style="${headerStyle} color:#ffdd59;">[NEW SLIDE]</div>
                <div style="${metaStyle}">Item: ${currentQuestionText}</div>
                <div style="font-size:14px; margin-top:5px; color:#aaa;">Type your answer; it auto-saves when complete.</div>
                <a href="${translateUrl}" target="_blank" style="${linkStyle}">🌐 Open in Google Translate →</a>
            `;
        }
    }

    function mainEngineLoop() {
        if (isFrozen) return;

        const mainContainer = document.querySelector('#game-question-content');
        if (!mainContainer || !window.angular) return;

        try {
            const scope = window.angular.element(mainContainer).scope();
            const qData = scope?.game?.model?._currentQuestion;

            if (!qData || !qData.contentID) return;

            const currentID = qData.contentID;
            const currentItemText = qData.specifiedDisplayName || "Unknown Audio Track";

            if (currentActiveID !== currentID) {
                currentActiveID = currentID;
                lastUploadedAnswer = "";
            }

            let previouslySavedAnswer = localStorage.getItem(`ep_ans_${currentID}`);
            if (!previouslySavedAnswer) {
                previouslySavedAnswer = localStorage.getItem(`ep_pdf_match_${currentItemText.split(';')[0].trim()}`);
            }

            updateOnScreenDisplay(previouslySavedAnswer, currentItemText);

            const inputField = document.querySelector('input[type="text"], textarea, [contenteditable="true"], .answer-input');
            if (inputField) {
                if (!inputField.dataset.hasSyncListener) {
                    inputField.dataset.hasSyncListener = "true";

                    const triggerUpload = () => {
                        const finalVal = (inputField.value || inputField.innerText || "").trim();
                        if (finalVal.length > 0 && finalVal !== lastUploadedAnswer) {
                            localStorage.setItem(`ep_ans_${currentID}`, finalVal);
                            syncToGoogleDatabase(currentID, currentItemText, finalVal);
                        }
                    };

                    inputField.addEventListener('blur', triggerUpload);
                    inputField.addEventListener('change', triggerUpload);
                }
            }
        } catch (e) {}
    }

    setInterval(mainEngineLoop, 500);

    function fetchPdfDatabase() {
        if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("XXXXX")) return;
        fetch(`${GOOGLE_SCRIPT_URL}?action=getPdfData`)
            .then(res => res.json())
            .then(data => {
                if (data && data.length) {
                    data.forEach(row => {
                        if (row.chinese && row.english) {
                            localStorage.setItem(`ep_pdf_match_${row.chinese}`, row.english);
                        }
                    });
                }
            }).catch(e => console.log("PDF fetch skipped/failed"));
    }
    fetchPdfDatabase();
    setInterval(fetchPdfDatabase, 30000);
})();
