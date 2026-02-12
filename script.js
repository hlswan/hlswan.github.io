const API = 'https://paceman.gg/api/ars/liveruns';
const nether_time = "rsg.enter_nether";
const bastion_time = "rsg.enter_bastion";
const fortress_time = "rsg.enter_fortress";
const first_portal_time = "rsg.first_portal";
const second_portal_time = "rsg.second_portal";
const enter_stronghold_time = "rsg.enter_stronghold";
const enter_end_time = "rsg.enter_end";
const credits_time = "rsg.credits";
const SPLITS = [
    { label: "Nether", key: nether_time},
    { label: "Bastion", key: bastion_time },
    { label: "Fortress", key: fortress_time },
    { label: "First Portal", key: first_portal_time },
    { label: "Second Portal", key: second_portal_time },
    { label: "Enter Stronghold", key: enter_stronghold_time },
    { label: "Enter End", key: enter_end_time },
    { label: "Credits", key: credits_time }
]

async function getRuns() {
    console.log("Getting runs...");
    let runs = await fetch(API).then(r => r.json()); //Get each run from API.


    //Filter to runs that have active liveAccounts(streamed runs).
    //Also doesn't break the script if liveAccount is null using the ? after it, 
    //returns undefined instead
    runs = runs.filter(r => r.user.liveAccount !== null);

    console.log(runs);

    if (runs.length == 0) {
        //no runs
    } else {
        const container = document.getElementById("runs-list");
        runs.forEach(run => {
            const splits = getSplitTimes(run);

            const div = document.createElement("div");
            div.className = "run";

            div.innerHTML = `
                <h2>${run.nickname}</h2>
                <div class="splits">

            `
        }
    }

    function getSplitTimes(run) {
        const nether = getEvent(run, nether_time);
        const bastion = getEvent(run, bastion_time);
        const fortress = getEvent(run, fortress_time);
        const first_portal = getEvent(run, first_portal_time);
        const second_portal = getEvent(run, second_portal_time);
        const enter_stronghold = getEvent(run, enter_stronghold_time);
        const enter_end = getEvent(run, enter_end_time);
        const credits = getEvent(run, credits_time);
        returnArray = [];
        if (!nether) {
            //no nether time, skip run(for now)
        } else {
            returnArray.push({ label: "Nether", time: nether.igt });
            if (bastion) {
                returnArray.push({ label: "Bastion", time: bastion.igt });
            } if (fortress) {
                returnArray.push({ label: "Fortress", time: fortress.igt });
            } if (first_portal) {
                returnArray.push({ label: "First Portal", time: first_portal.igt });
            } if (second_portal) {
                returnArray.push({ label: "Second Portal", time: second_portal.igt });
            } if (enter_stronghold) {
                returnArray.push({ label: "Stronghold", time: enter_stronghold.igt });
            } if (enter_end) {
                returnArray.push({ label: "End", time: enter_end.igt });
            } if (credits) {
                returnArray.push({ label: "Credits", time: credits.igt });
        }

        return returnArray;
    }

    function getEvent(run, key) {
        return run.events.find(e => e.key === key);
    }

    


    
}
getRuns();
setInterval(getRuns, 20000);