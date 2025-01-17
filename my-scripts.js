// Global variables =======================================================================
const urlParams = new URLSearchParams(window.location.search);

const playlist_URLs = {
    openers:   urlParams.get('openers'),
    relievers: urlParams.get('relievers'),
    closers:   urlParams.get('closers')
}

let playlists_videos = {};

let playlists_retrieved = false;
        
// Leverage YouTube iframe API to mine playlists ==========================================

function make_playlist_miner(which_playlist) {
    
    new YT.Player(`player-${which_playlist}`, {
        //height: '390',
        //width: '640',
        playerVars: {
            listType: 'playlist',
            list: playlist_URLs[which_playlist]
        },
        events: {
            'onReady': (event) => {on_miner_ready(event, which_playlist)}
            //'onStateChange': onPlayerStateChange
        }
    });
    
}

function onYouTubeIframeAPIReady() {
    
    make_playlist_miner('openers');
    make_playlist_miner('relievers');
    make_playlist_miner('closers');
    
}

function on_miner_ready(event, playlist_i) {
    
    playlists_videos[playlist_i] = event.target.getPlaylist();
    
    // Managed via CSS directly instead. Starts display = 'none' for better UX.
    //document.getElementById(`div-${playlist_i}`).style.display = 'none';
    
    // Anyone who loads early chills; whichever loads last triggers the rest of the action
    maybe_get_all_video_info();
    
}

// Get video info from oEmbed API =========================================================

async function get_video_info_single(videoId) {
    
    const apiUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    
    try {
        
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            throw new Error('API request failed');
        }
        
        const data = await response.json();
        
        return {
            id: videoId,
            title: data.title
        }
        
    } catch (error) {
        
        return {
            id: videoId,
            title: "⚠ Unable to embed video ⚠"
        }
        
    }
}

async function get_video_info_array(videoId_array) {
    
    const promises = videoId_array.map(video_i => get_video_info_single(video_i));
    
    const results = await Promise.all(promises);
    
    return results;
    
}

async function maybe_get_all_video_info() {
    
    // TODO: Race conditions...?
    
    if(
        'openers'   in playlists_videos && 
        'relievers' in playlists_videos && 
        'closers'   in playlists_videos &&
        !playlists_retrieved
    ){
                        
        playlists_retrieved = true;
        
        // Fetch data for videos in playlists
        const playlistPromises = Object.keys(playlists_videos).map(async (playlist_i) => {
            console.log(`Fetching info for playlist: ${playlist_i}`);
            const results = await get_video_info_array(playlists_videos[playlist_i]);
            playlists_videos[playlist_i] = results;
        });

        await Promise.all(playlistPromises);

        // Hand off for final steps
        construct_final_playlist();
        
    }
    
    return;
    
}

// Construct our own playlist =============================================================

let our_player;

let final_playlist = [];
let final_playlist_index = 0;

function getRandomVideos(videos, n) {
    
    const shuffled = videos.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, n);
    
}

function shuffle_playlist() {
    
    final_playlist = [
        ...getRandomVideos(playlists_videos['openers'], 1),
        ...getRandomVideos(playlists_videos['relievers'], 3),
        ...getRandomVideos(playlists_videos['closers'], 1)
    ]
    
}

function make_final_youtube_player() {
    
    our_player = new YT.Player('player', {
        //height: '360',
        //width: '640',
        videoId: final_playlist[0].id,
        events: {
            'onReady': our_player_ready,
            'onStateChange': our_player_state_change
        }
    });
    
}

function our_player_ready(event) {
    our_player.playVideo();
}

function our_player_state_change(event) {
    if (event.data == YT.PlayerState.ENDED) {
        playNextVideo();
    }
}

function playNextVideo() {
    const currentIndex = final_playlist.findIndex(video => video.id === our_player.getVideoData().video_id);
    const nextIndex = (currentIndex + 1) % final_playlist.length;
    our_player.loadVideoById(final_playlist[nextIndex].id);
}

function updatePlaylistUI() {
    const playlistElement = document.getElementById('playlist');
    final_playlist.forEach((video, index) => {
        const vid_div = document.createElement('div');
        vid_div.textContent = `${video.title}`;
        vid_div.classList.add("playlist-item");
        vid_div.onclick = () => our_player.loadVideoById(video.id);
        playlistElement.appendChild(vid_div);
    });
}

function construct_final_playlist() {
    
    shuffle_playlist();
    
    make_final_youtube_player();
    
    updatePlaylistUI();
    
}
