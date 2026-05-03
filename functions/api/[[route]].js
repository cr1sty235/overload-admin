// ─────────────────────────────────────────────────────────────────────────────
//  Overload Admin — Cloudflare Pages Function
//  Handles all /api/* routes. Secrets are set in:
//  Cloudflare Dashboard → Pages → Your Project → Settings → Environment Variables
//    PLAYFAB_TITLE_ID   (plain variable)
//    PLAYFAB_SECRET_KEY (secret)
//    ADMIN_TOKEN        (secret)
// ─────────────────────────────────────────────────────────────────────────────

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders() });
    }

    if (request.method !== 'POST') {
        return response({ error: 'POST only' }, 405);
    }

    // Auth check
    const token = request.headers.get('X-Admin-Token');
    if (!token || token !== env.ADMIN_TOKEN) {
        return response({ error: 'Unauthorized' }, 401);
    }

    const body = await request.json().catch(() => ({}));
    const route = url.pathname.replace('/api/', '');

    try {
        return response(await handleRoute(route, body, env));
    } catch (e) {
        return response({ error: e.message }, 500);
    }
}

// ── Route handler ─────────────────────────────────────────────────────────────

async function handleRoute(route, body, env) {
    switch (route) {

        // ── Players ──
        case 'lookup-player': {
            const query = body.playFabId;
            const profileConstraints = {
                ShowDisplayName: true, ShowLocations: true,
                ShowLastLogin: true, ShowCreated: true,
            };

            const isHexId = /^[0-9A-Fa-f]{12,20}$/.test(query);

            // 1. If it looks like a hex ID try GetPlayerProfile directly
            if (isHexId) {
                const result = await pfAdmin('GetPlayerProfile', {
                    PlayFabId: query, ProfileConstraints: profileConstraints,
                }, env);
                if (result.code === 200 && result.data?.PlayerProfile) return result;
            }

            // 2. Search by TitleDisplayName or Username via GetUserAccountInfo
            //    (correct Admin API endpoint — LookupUserAccountInfo does not exist)
            const byName = await pfAdmin('GetUserAccountInfo', {
                TitleDisplayName: query,
            }, env).catch(() => null);

            if (byName?.code === 200 && byName?.data?.UserInfo?.PlayFabId) {
                const result = await pfAdmin('GetPlayerProfile', {
                    PlayFabId: byName.data.UserInfo.PlayFabId,
                    ProfileConstraints: profileConstraints,
                }, env);
                if (result.code === 200 && result.data?.PlayerProfile) return result;
            }

            // 3. Try as Username
            const byUsername = await pfAdmin('GetUserAccountInfo', {
                Username: query,
            }, env).catch(() => null);

            if (byUsername?.code === 200 && byUsername?.data?.UserInfo?.PlayFabId) {
                const result = await pfAdmin('GetPlayerProfile', {
                    PlayFabId: byUsername.data.UserInfo.PlayFabId,
                    ProfileConstraints: profileConstraints,
                }, env);
                if (result.code === 200 && result.data?.PlayerProfile) return result;
            }

            return { code: 404, data: null, errorMessage: 'Player not found' };
        }

        case 'get-account': {
            const query = body.playFabId;
            let result = await pfAdmin('GetUserAccountInfo', { PlayFabId: query }, env);
            if (result.code === 200) return result;
            result = await pfAdmin('GetUserAccountInfo', { TitleDisplayName: query }, env).catch(() => null);
            if (result?.code === 200) return result;
            return { code: 404, data: null };
        }

        case 'get-inventory':
            return pfServer('GetUserInventory', {
                PlayFabId: body.playFabId,
                CatalogVersion: body.catalogVersion || '',
            }, env);

        case 'get-userdata':
            return pfServer('GetUserData', {
                PlayFabId: body.playFabId,
                Keys: body.keys || [],
            }, env);

        case 'set-userdata':
            return pfServer('UpdateUserData', {
                PlayFabId: body.playFabId,
                Data: body.data,
            }, env);

        case 'grant-items':
            return pfServer('GrantItemsToUser', {
                PlayFabId: body.playFabId,
                ItemIds: body.itemIds,
                CatalogVersion: body.catalogVersion || '',
            }, env);

        case 'revoke-item':
            return pfAdmin('RevokeInventoryItem', {
                PlayFabId: body.playFabId,
                ItemInstanceId: body.itemInstanceId,
            }, env);

        case 'add-currency':
            return pfServer('AddUserVirtualCurrency', {
                PlayFabId: body.playFabId,
                VirtualCurrency: body.currencyCode,
                Amount: body.amount,
            }, env);

        case 'subtract-currency':
            return pfServer('SubtractUserVirtualCurrency', {
                PlayFabId: body.playFabId,
                VirtualCurrency: body.currencyCode,
                Amount: body.amount,
            }, env);

        case 'ban-player':
            return pfAdmin('BanUsers', {
                Bans: [{ PlayFabId: body.playFabId, Reason: body.reason, DurationInHours: body.durationInHours || null }]
            }, env);

        case 'get-bans':
            return pfAdmin('GetUserBans', { PlayFabId: body.playFabId }, env);

        case 'revoke-ban':
            return pfAdmin('RevokeBans', { BanIds: [body.banId] }, env);

        // ── Catalog ──
        case 'get-catalog':
            return pfAdmin('GetCatalogItems', { CatalogVersion: body.catalogVersion || '' }, env);

        // ── Mail — single player ──
        case 'send-mail': {
            const mailKey = 'SystemMail';
            const existing = await pfServer('GetUserData', { PlayFabId: body.playFabId, Keys: [mailKey] }, env);

            let mailArr = [];
            try {
                const raw = existing.data?.Data?.[mailKey]?.Value;
                if (raw) mailArr = JSON.parse(raw);
            } catch (e) { mailArr = []; }

            const item = {
                id: Date.now().toString(),
                subject: body.subject || '(No subject)',
                body: body.body || '',
                from: 'Admin',
                sentAt: new Date().toISOString(),
                claimed: false,
                deleted: false,
                grants: {
                    itemIds: body.itemIds || [],
                    currencyCode: body.currencyCode || '',
                    currencyAmt: body.currencyAmt || 0,
                }
            };

            mailArr.unshift(item);
            if (mailArr.length > 50) mailArr = mailArr.slice(0, 50);

            const writeData = {};
            writeData[mailKey] = JSON.stringify(mailArr);
            const result = await pfServer('UpdateUserData', { PlayFabId: body.playFabId, Data: writeData }, env);

            await appendSentLog(env, { type: 'single', to: body.playFabId, subject: item.subject, sentAt: item.sentAt });
            return result;
        }

        // ── Mail — broadcast to all players ──
        case 'broadcast-mail': {
            const broadcastKey = 'BroadcastMail';
            const existing = await pfAdmin('GetTitleData', { Keys: [broadcastKey] }, env);

            let broadcasts = [];
            try {
                const raw = existing.data?.Data?.[broadcastKey];
                if (raw) broadcasts = JSON.parse(raw);
            } catch (e) { broadcasts = []; }

            const item = {
                id: Date.now().toString(),
                subject: body.subject || '(No subject)',
                body: body.body || '',
                from: 'Admin',
                sentAt: new Date().toISOString(),
                grants: {
                    itemIds: body.itemIds || [],
                    currencyCode: body.currencyCode || '',
                    currencyAmt: body.currencyAmt || 0,
                }
            };

            broadcasts.unshift(item);
            if (broadcasts.length > 20) broadcasts = broadcasts.slice(0, 20);

            const result = await pfAdmin('SetTitleData', { Key: broadcastKey, Value: JSON.stringify(broadcasts) }, env);
            await appendSentLog(env, { type: 'broadcast', to: 'ALL PLAYERS', subject: item.subject, sentAt: item.sentAt });
            return result;
        }

        case 'get-sent-log': {
            const r = await pfAdmin('GetTitleData', { Keys: ['AdminSentLog'] }, env);
            let log = [];
            try { const raw = r.data?.Data?.AdminSentLog; if (raw) log = JSON.parse(raw); } catch (e) { log = []; }
            return { code: 200, data: log };
        }

        case 'get-broadcasts': {
            const r = await pfAdmin('GetTitleData', { Keys: ['BroadcastMail'] }, env);
            let list = [];
            try { const raw = r.data?.Data?.BroadcastMail; if (raw) list = JSON.parse(raw); } catch (e) { list = []; }
            return { code: 200, data: list };
        }

        case 'delete-broadcast': {
            const r = await pfAdmin('GetTitleData', { Keys: ['BroadcastMail'] }, env);
            let list = [];
            try { const raw = r.data?.Data?.BroadcastMail; if (raw) list = JSON.parse(raw); } catch (e) { list = []; }
            list = list.filter(b => b.id !== body.id);
            return pfAdmin('SetTitleData', { Key: 'BroadcastMail', Value: JSON.stringify(list) }, env);
        }

        // ── Search players by display name ──
        // Uses a dedicated D1-backed search worker for full-text search.
        // SEARCH_WORKER_URL and SEARCH_API_KEY must be set in Pages env variables.
        case 'search-players': {
            const query = (body.query || '').trim();
            if (!query) return { code: 400, errorMessage: 'No search query provided.' };

            if (!env.SEARCH_WORKER_URL) return { code: 500, errorMessage: 'SEARCH_WORKER_URL not configured in environment variables.' };

            const r = await fetch(env.SEARCH_WORKER_URL + '/search?q=' + encodeURIComponent(query), {
                headers: { 'x-api-key': env.SEARCH_API_KEY || '' }
            });

            if (!r.ok) return { code: 500, errorMessage: 'Search worker returned ' + r.status };

            const results = await r.json();
            return {
                code: 200,
                data: results.map(function (p) {
                    return { playFabId: p.playfab_id, displayName: p.display_name };
                })
            };
        }

        // ── Index a player into the D1 search database ──
        // Called automatically after every successful player lookup by ID.
        case 'add-announcement':
            return pfAdmin('AddNews', {
                Title: body.title || '(No title)',
                Body: body.body || '',
                Timestamp: new Date().toISOString(),
            }, env);

        case 'get-announcements':
            return pfAdmin('GetTitleNews', { Count: 50 }, env);

        // ── Popups ──
        case 'send-popup': {
            const popup = { message: body.message || '', sentAt: new Date().toISOString(), id: Date.now().toString() };
            return pfAdmin('SetTitleData', { Key: 'ActivePopup', Value: JSON.stringify(popup) }, env);
        }

        case 'clear-popup':
            return pfAdmin('SetTitleData', { Key: 'ActivePopup', Value: '' }, env);

        case 'get-popup': {
            const r = await pfAdmin('GetTitleData', { Keys: ['ActivePopup'] }, env);
            let popup = null;
            try { const raw = r.data?.Data?.ActivePopup; if (raw) popup = JSON.parse(raw); } catch (e) { popup = null; }
            return { code: 200, data: popup };
        }

        // ── Panic Shutdown ──
        case 'set-panic':
            return pfAdmin('SetTitleData', { Key: 'PanicShutdown', Value: body.enabled ? 'true' : 'false' }, env);

        case 'get-panic': {
            const r = await pfAdmin('GetTitleData', { Keys: ['PanicShutdown'] }, env);
            const raw = r.data?.Data?.PanicShutdown;
            return { code: 200, data: raw === 'true' };
        }

        default:
            return { error: 'Unknown route' };
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function appendSentLog(env, entry) {
    try {
        const r = await pfAdmin('GetTitleData', { Keys: ['AdminSentLog'] }, env);
        let log = [];
        try { const raw = r.data?.Data?.AdminSentLog; if (raw) log = JSON.parse(raw); } catch (e) { log = []; }
        log.unshift(entry);
        if (log.length > 100) log = log.slice(0, 100);
        await pfAdmin('SetTitleData', { Key: 'AdminSentLog', Value: JSON.stringify(log) }, env);
    } catch (e) { }
}

async function pfAdmin(endpoint, body, env) { return pfCall('Admin', endpoint, body, env); }
async function pfServer(endpoint, body, env) { return pfCall('Server', endpoint, body, env); }

async function pfCall(api, endpoint, body, env) {
    const r = await fetch(
        `https://${env.PLAYFAB_TITLE_ID}.playfabapi.com/${api}/${endpoint}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-SecretKey': env.PLAYFAB_SECRET_KEY },
            body: JSON.stringify(body),
        }
    );
    return r.json();
}

function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
}

function response(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
}