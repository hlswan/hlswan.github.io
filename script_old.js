const API_URL = 'https://paceman.gg/api/ars/liveruns';
const TOP_RUNNERS_TXT = '/top_runners.txt';
const BACKUP_STREAMING_LOGINS = new Set();
const DEFAULT_CHANNEL = "nofearr1337";
const TWITCH_API_URL = 'https://api.twitch.tv/helix/streams?';
const TWITCH_CLIENT_ID = 'tyeyyg0yk84cyvevw426mz0k8iz9q3';
const PARENT_DOMAIN = "hlswan.github.io";
const SPLITS = [
    { label: "Nether Enter", key: "rsg.enter_nether" },
    { label: "Structure 1 Enter", key: "structure1" },
    { label: "Structure 2 Enter", key: "structure2" },
    { label: "First Portal", key: "rsg.first_portal" },
    { label: "Stronghold Enter", key: "rsg.enter_stronghold" },
    { label: "End Enter", key: "rsg.enter_end" },
    { label: "Credits", key: "rsg.credits" }
];
const PACE_THRESHOLDS = [
    { key: "rsg.enter_end", label: "End", time: 9 * 60 * 1000 },
    { key: "rsg.enter_stronghold", label: "Stronghold", time: 8.5 * 60 * 1000 },
    { key: "rsg.first_portal", label: "First Portal", time: 7 * 60 * 1000 },
    { key: "structure2", label: "Structure 2", time: 5.5 * 60 * 1000 },
    { key: "structure1", label: "Structure 1", time: 3 * 60 * 1000 },
    { key: "rsg.enter_nether", label: "Nether", time: 2.5 * 60 * 1000 },
];

let openDropdowns = new Set();

let MAX_CACHED_IFRAMES = 10;
let liveIframes = new Map();

function trimCachedIframes() {
    while (liveIframes.size > MAX_CACHED_IFRAMES) {
        const oldestKey = liveIframes.keys().next().value;
        const iframe = liveIframes.get(oldestKey);
        if (iframe && iframe.parentElement) iframe.parentElement.removeChild(iframe);
        liveIframes.delete(oldestKey);
    }
}

function touchCachedIframe(handle, iframeElement) {
    const key = handle.toLowerCase();
    if (liveIframes.has(key)) {
        const el = liveIframes.get(key);
        liveIframes.delete(key);
        liveIframes.set(key, el);
        return el;
    }
    if (iframeElement) {
        liveIframes.set(key, iframeElement);
        trimCachedIframes();
        return iframeElement;
    }
    return null;
}

let currentMainChannel = DEFAULT_CHANNEL;
let currentSideChannel = null;

let topRunnersOrder = [];
let TOP_RUNNER_LOGINS_SET = new Set();


document.getElementById("settings-btn").onclick = () => {
    document.getElementById("settings-panel").classList.toggle("hidden");
};
document.getElementById("save-settings").onclick = () => {
    const input = document.getElementById("iframe-limit");
    let val = parseInt(input.value);
    if (isNaN(val) || val < 1) val = 1;
    if (val > 30) val = 30;

    MAX_CACHED_IFRAMES = val;
    trimCachedIframes();
    document.getElementById("settings-panel").classList.add("hidden");
};

// helpers
function getEvent(run, eventId) {
    return run.eventList.find(e => e.eventId === eventId);
}
function getStructures(run) {
    const structures = run.eventList.filter(e =>
        e.eventId === "rsg.enter_bastion" || e.eventId === "rsg.enter_fortress"
    );
    structures.sort((a, b) => a.rta - b.rta);
    return { structure1: structures[0], structure2: structures[1] };
}
function msToTime(ms) {
    if (ms == null) return "—";
    const seconds = Math.floor(ms / 1000);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

function getRunPaceTier(run) {
    const { structure1, structure2 } = getStructures(run);
    const events = {
        "rsg.enter_end": getEvent(run, "rsg.enter_end")?.igt,
        "rsg.enter_stronghold": getEvent(run, "rsg.enter_stronghold")?.igt,
        "rsg.first_portal": getEvent(run, "rsg.first_portal")?.igt,
        "structure2": structure2?.igt,
        "structure1": structure1?.igt,
        "rsg.enter_nether": getEvent(run, "rsg.enter_nether")?.igt
    };

    for (let i = 0; i < PACE_THRESHOLDS.length; i++) {
        const { key, time } = PACE_THRESHOLDS[i];
        if (events[key] != null && events[key] <= time) return i;
    }
    return PACE_THRESHOLDS.length;
}
function isOnPace(run) {
    return getRunPaceTier(run) < PACE_THRESHOLDS.length;
}

function runisLive(run, increment) {
    if (increment >= 100) { 
        BACKUP_STREAMING_LOGINS = new Set();
    }
    if (run.user?.liveAccount) {
        TOP_RUNNER_LOGINS_SET.forEach(item => {
            if (item.toLowerCase() === run.user.liveAccount.toLowerCase()) {
                BACKUP_STREAMING_LOGINS.add(run.user.liveAccount.toLowerCase());
            }
        });
        return true;
    }
    return false;
}

function filterToLiveRuns(runs) {
    return runs.filter(runisLive);
}

// findLiveTopRunners: query Twitch Helix to determine which of the topList handles are currently streaming.
// Returns an array (max length 2) of handles from topList in file order that are currently streaming.
// This function does NOT check paceman runs; caller will use this only when no live sub10 runs exist.
async function findLiveTopRunners(topList) {
    if (!Array.isArray(topList) || topList.length === 0) return [];

    // sanitize and dedupe
    const uniqueList = [...new Set(
        topList
            .map(s => (s || "").toLowerCase().trim())
            .filter(Boolean)
    )];
    if (uniqueList.length === 0) return [];

    const params = uniqueList.map(s => `user_login=${encodeURIComponent(s)}`).join('&');
    const url = TWITCH_API_URL + params;

    // Accept several token names (browser/global or localStorage)
    const token =
        window.TWITCH_OAUTH_TOKEN ||
        window.TWITCH_AUTH_TOKEN ||
        window.TWITCH_AUTH ||
        localStorage.getItem('twitch_oauth_token') ||
        localStorage.getItem('twitch_auth_token') ||
        null;

    const headers = { 'Client-ID': TWITCH_CLIENT_ID };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    else console.warn('No Twitch OAuth token found; Helix may reject the request.');

    const streamingLogins = new Set();
    try {
        const res = await fetch(url, { headers });
        if (!res.ok) {
            console.warn('Twitch API responded with', res.status, res.statusText);
            try { const body = await res.text(); console.warn('Twitch body:', body); } catch (_) { }
            streamingLogins = useBackupStreamingLogins(streamingLogins);
        } else {
            const data = await res.json();
            (data.data || []).forEach(s => {
                const login = (s.user_login || s.user_name || '').toLowerCase();
                if (login) streamingLogins.add(login);
            });
        }
    } catch (e) {
        console.warn('Failed querying Twitch API for streaming top runners', e);
    }

    // Return up to the first two topList handles (in file order) that are streaming
    const result = [];
    for (const handle of topList) {
        const key = (handle || "").toLowerCase();
        if (streamingLogins.has(key)) {
            result.push(handle);
            if (result.length >= 2) break;
        }
    }
    return result;
}

//If twitch API fails get the backup list of logins.
function useBackupStreamingLogins(streamingLogins) {
    streamingLogins = new Set([...BACKUP_STREAMING_LOGINS]);
    return streamingLogins;
}

function getRunProgress(run) {
    const { structure1, structure2 } = getStructures(run);
    if (getEvent(run, "rsg.credits")) return 8;
    if (getEvent(run, "rsg.enter_end")) return 7;
    if (getEvent(run, "rsg.enter_stronghold")) return 6;
    if (getEvent(run, "rsg.first_portal")) return 5;
    if (structure2) return 4;
    if (structure1) return 3;
    if (getEvent(run, "rsg.enter_nether")) return 2;
    return 0;
}

function getFinishPriority(run, topSet) {
    const hasEnd = !!getEvent(run, "rsg.enter_end");
    const hasStrong = !!getEvent(run, "rsg.enter_stronghold");
    const hasPortal = !!getEvent(run, "rsg.first_portal");
    const { structure1, structure2 } = getStructures(run);
    const hasS2 = !!structure2;
    const hasS1 = !!structure1;
    const hasNether = !!getEvent(run, "rsg.enter_nether");
    const onPace = isOnPace(run);
    const liveHandle = run.user?.liveAccount?.toLowerCase();
    const isTopRunner = liveHandle && topSet && topSet.has(liveHandle);

    if (onPace && hasEnd) return 0;
    if (onPace && hasStrong) return 1;
    if (onPace && hasPortal) return 2;
    if (onPace && hasS2) return 3;
    if (onPace && hasS1) return 4;
    if (onPace && hasNether) return 5;
    if (isTopRunner) return 6;
    if (hasEnd) return 7;
    if (hasStrong) return 8;
    if (hasPortal) return 9;
    if (hasS2) return 10;
    if (hasS1) return 11;
    if (hasNether) return 12;
    return 13;
}

// Sort runs by finish closeness (unchanged behaviour)
function sortRunsByFinishCloseness(runs, topOrder) {
    const topSet = new Set((topOrder || []).map(s => (s || "").toLowerCase()));
    return runs.sort((a, b) => {
        const pa = getFinishPriority(a, topSet);
        const pb = getFinishPriority(b, topSet);
        if (pa !== pb) return pa - pb;

        const tierA = getRunPaceTier(a);
        const tierB = getRunPaceTier(b);
        if (tierA !== tierB) return tierA - tierB;

        const keyA = PACE_THRESHOLDS[tierA]?.key;
        const keyB = PACE_THRESHOLDS[tierB]?.key;
        const timeA = keyA ? ((keyA.includes("structure") ? getStructures(a)[keyA] : getEvent(a, keyA))?.igt) : null;
        const timeB = keyB ? ((keyB.includes("structure") ? getStructures(b)[keyB] : getEvent(b, keyB))?.igt) : null;
        if (timeA != null && timeB != null && timeA !== timeB) return timeA - timeB;

        const progressA = getRunProgress(a);
        const progressB = getRunProgress(b);
        if (progressA !== progressB) return progressB - progressA;

        return 0;
    });
}

async function loadTopRunnersList() {
    try {
        const res = await fetch(TOP_RUNNERS_TXT, { cache: "no-cache" });
        if (!res.ok) return [];
        const txt = await res.text();
        const lines = txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        topRunnersOrder = lines;
        TOP_RUNNER_LOGINS_SET = new Set(lines.map(s => s.toLowerCase()));
        return lines;
    } catch (e) {
        console.warn("Failed to load top_runners.txt", e);
        return [];
    }
}

function ensureCachedTopIframes(handles) {
    const cacheContainer = document.getElementById("iframe-cache");
    for (const rawHandle of handles) {
        if (liveIframes.size >= MAX_CACHED_IFRAMES) break;
        const key = rawHandle.toLowerCase();
        if (liveIframes.has(key)) {
            touchCachedIframe(rawHandle);
            continue;
        }
        const ifr = document.createElement("iframe");
        ifr.src = `https://player.twitch.tv/?channel=${encodeURIComponent(rawHandle)}&parent=${PARENT_DOMAIN}&muted=true`;
        ifr.id = `cached-${rawHandle}`;
        ifr.setAttribute("scrolling", "no");
        ifr.style.width = "320px";
        ifr.style.height = "180px";
        ifr.style.border = "0";
        ifr.style.display = "none";
        cacheContainer.appendChild(ifr);
        touchCachedIframe(rawHandle, ifr);
    }
}

function updateIframeSlots({ mainChannel, sideChannel, useTwoUp }) {
    const main = document.getElementById("twitch-player-main");
    const side = document.getElementById("twitch-player-side");
    const streamDiv = document.getElementById("stream");
    const sideWrapper = document.getElementById("side-player-wrapper");

    streamDiv.classList.toggle("two-up", !!useTwoUp);
    streamDiv.classList.toggle("single", !useTwoUp);

    if (sideChannel) sideWrapper.classList.remove("hidden");
    else sideWrapper.classList.add("hidden");

    if (mainChannel && mainChannel !== currentMainChannel) {
        main.src = `https://player.twitch.tv/?channel=${encodeURIComponent(mainChannel)}&parent=${PARENT_DOMAIN}&muted=true`;
        currentMainChannel = mainChannel;
        if (liveIframes.has((mainChannel || "").toLowerCase())) touchCachedIframe(mainChannel);
    }
    if (sideChannel && sideChannel !== currentSideChannel) {
        side.src = `https://player.twitch.tv/?channel=${encodeURIComponent(sideChannel)}&parent=${PARENT_DOMAIN}&muted=true`;
        currentSideChannel = sideChannel;
        if (liveIframes.has((sideChannel || "").toLowerCase())) touchCachedIframe(sideChannel);
    }
}

function renderRuns(runs) {
    const container = document.getElementById("runs-list");
    openDropdowns.clear();
    document.querySelectorAll(".splits").forEach((div, index) => {
        if (!div.classList.contains("hidden")) openDropdowns.add(index);
    });
    container.innerHTML = "";

    runs.forEach((run, i) => {
        const splits = getSplitData(run);
        const latest = getLatestSplit(splits);
        const { structure1, structure2 } = getStructures(run);
        const nether = getEvent(run, "rsg.enter_nether");
        const firstPortal = getEvent(run, "rsg.first_portal");
        const stronghold = getEvent(run, "rsg.enter_stronghold");
        const end = getEvent(run, "rsg.enter_end");

        const div = document.createElement("div");
        div.className = "run";

        if (end?.igt != null && end.igt <= 9 * 60 * 1000) div.classList.add("sub10");
        else if (stronghold?.igt != null && stronghold.igt <= 8.5 * 60 * 1000) div.classList.add("sub830");
        else if (firstPortal?.igt != null && firstPortal.igt <= 7 * 60 * 1000) div.classList.add("sub7");
        else if (structure2?.igt != null && structure2.igt <= 5.5 * 60 * 1000) div.classList.add("sub530");

        div.innerHTML = `
            <div class="run-header ${run.user?.liveAccount ? "live" : ""}">
                <strong>${run.nickname}</strong>
                ${run.user?.liveAccount ? " LIVE" : ""}
            </div>

            <div class="latest-split">
                ${latest ? `${latest.label}: <b>${msToTime(latest.time)}</b>` : "No splits yet"}
            </div>

            <button class="toggle" data-id="${i}">Show all splits</button>

            <div class="splits hidden">
                ${splits.map(s => `<div>${s.label}: <b>${s.time ? msToTime(s.time) : "—"}</b></div>`).join("")}
            </div>
        `;
        container.appendChild(div);
    });

    document.querySelectorAll(".toggle").forEach(button => {
        button.onclick = () => {
            const splitsDiv = button.nextElementSibling;
            splitsDiv.classList.toggle("hidden");
        };
    });
}

function getSplitData(run) {
    const nether = getEvent(run, "rsg.enter_nether");
    const { structure1, structure2 } = getStructures(run);
    const firstPortal = getEvent(run, "rsg.enter_portal");
    const stronghold = getEvent(run, "rsg.enter_stronghold");
    const end = getEvent(run, "rsg.enter_end");
    const credits = getEvent(run, "rsg.credits");

    return [
        { label: "Nether Enter", time: nether?.igt },
        { label: "Structure 1 Enter", time: structure1?.igt },
        { label: "Structure 2 Enter", time: structure2?.igt },
        { label: "First Portal", time: firstPortal?.igt },
        { label: "Stronghold Enter", time: stronghold?.igt },
        { label: "End Enter", time: end?.igt },
        { label: "Credits", time: credits?.igt }
    ];
}

function getLatestSplit(splits) {
    return [...splits].reverse().find(s => s.time != null);
}

// Main selection flow: filter to live runs first, show live sub10 if any; only if none, query Twitch for top runners.
async function fetchLiveRuns() {
    try {
        const topList = await loadTopRunnersList();

        let runs = await fetch(API_URL).then(r => r.json());

        // Filter to live runs for display and selection
        const liveRuns = filterToLiveRuns(runs);

        // Sort live runs by closeness to finishing
        const sortedLiveRuns = sortRunsByFinishCloseness(liveRuns.slice(), topList);

        // Render only live runs (user asked to show live-only)
        renderRuns(sortedLiveRuns);

        // Prefer a live sub10 run
        const liveSub10 = sortedLiveRuns.find(r => isOnPace(r));
        if (liveSub10) {
            const mainChannel = liveSub10.user.liveAccount;
            // side: prefer another live run different from main
            const sideRun = sortedLiveRuns.find(r => r.user?.liveAccount && r.user.liveAccount.toLowerCase() !== mainChannel.toLowerCase());
            const sideChannel = sideRun ? sideRun.user.liveAccount : null;
            updateIframeSlots({ mainChannel, sideChannel, useTwoUp: !!sideChannel });
            // warm top runners: none needed here (we're showing liveSub10)
            return;
        }

        // No live sub10 runs: ask Twitch which top runners are streaming (top two)
        const topTwoStreaming = await findLiveTopRunners(topList);
        // Warm cached iframes only for those streaming
        ensureCachedTopIframes(topTwoStreaming);

        // Use top two streaming top-runners if available
        if (topTwoStreaming.length >= 2) {
            updateIframeSlots({ mainChannel: topTwoStreaming[0], sideChannel: topTwoStreaming[1], useTwoUp: true });
            return;
        }
        if (topTwoStreaming.length === 1) {
            const mainChannel = topTwoStreaming[0];
            const sideRun = sortedLiveRuns.find(r => r.user?.liveAccount && r.user.liveAccount.toLowerCase() !== mainChannel.toLowerCase());
            const sideChannel = sideRun ? sideRun.user.liveAccount : null;
            updateIframeSlots({ mainChannel, sideChannel, useTwoUp: !!sideChannel });
            return;
        }

        // Fallback: show top two live runs if any, otherwise default channel
        const firstLive = sortedLiveRuns[0];
        const secondLive = sortedLiveRuns.find(r => r.user?.liveAccount && r.user.liveAccount.toLowerCase() !== (firstLive?.user?.liveAccount || "").toLowerCase());
        const mainChannel = firstLive ? firstLive.user.liveAccount : DEFAULT_CHANNEL;
        const sideChannel = secondLive ? secondLive.user.liveAccount : null;
        updateIframeSlots({ mainChannel, sideChannel, useTwoUp: !!sideChannel });

    } catch (err) {
        console.error(err);
        document.getElementById("runs-list").textContent = "Failed to load live runs.";
    }
}

fetchLiveRuns();
setInterval(fetchLiveRuns, 10000);