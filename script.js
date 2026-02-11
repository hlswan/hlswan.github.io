const API = 'https://paceman.gg/api/ars/liveruns';
const SPLITS = [
    { label: "Nether", key: "rsg.enter_nether"},
    { label: "Bastion", key: "rsg.enter_bastion" },
    { label: "Fortress", key: "rsg.enter_fortress" },
    { label: "First Portal", key: "rsg.first_portal" },
    { label: "Second Portal", key: "rsg.second_portal" },
    { label: "Enter Stronghold", key: "rsg.enter_stronghold" },
    { label: "Enter End", key: "rsg.enter_end" },
    { label: "Credits", key: "rsg.credits" }    
]

function getRuns() {
    let runs = await fetch(API).then(r => r.json()); //Get each run from API.


    //Filter to runs that have active liveAccounts(streamed runs).
    //Also doesn't break the script if liveAccount is null using the ? after it, 
    //returns undefined instead
    runs = runs.filter(r => r.user.liveAccount ? != null);

    console.log(runs);

    if (runs.length == 0) {
        //no runs
    } else {
        console.log(runs);
    }


    getRuns();
    setInterval(getRuns, 10000);
}