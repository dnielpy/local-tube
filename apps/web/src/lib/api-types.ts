
export interface paths {
    "/api/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["health_api_health_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/videos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["list_videos_api_videos_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/videos/channels": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["list_channels_api_videos_channels_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/videos/{video_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["get_video_api_videos__video_id__get"];
        put?: never;
        post?: never;
        delete: operations["delete_video_api_videos__video_id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/videos/{video_id}/stream": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["stream_video_api_videos__video_id__stream_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/videos/{video_id}/thumbnail": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["video_thumbnail_api_videos__video_id__thumbnail_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/downloads/formats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["video_formats_api_downloads_formats_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/downloads": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["list_downloads_api_downloads_get"];
        put?: never;
        post: operations["create_download_api_downloads_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/downloads/{job_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["get_download_api_downloads__job_id__get"];
        put?: never;
        post?: never;
        delete: operations["delete_download_api_downloads__job_id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/downloads/{job_id}/thumbnail": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["download_thumbnail_api_downloads__job_id__thumbnail_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/downloads/{job_id}/retry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["retry_download_api_downloads__job_id__retry_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/downloads/{job_id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["cancel_download_api_downloads__job_id__cancel_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["get_status_api_status_get"];
        put: operations["update_status_api_status_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/channels": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["list_channels_api_channels_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/channels/sync": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["sync_channels_api_channels_sync_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/channels/{channel_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["get_channel_api_channels__channel_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/channels/{channel_id}/videos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["channel_videos_api_channels__channel_id__videos_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/channels/{channel_id}/avatar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["channel_avatar_api_channels__channel_id__avatar_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/channels/{channel_id}/banner": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["channel_banner_api_channels__channel_id__banner_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/channel-videos/{youtube_id}/thumbnail": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["channel_video_thumbnail_api_channel_videos__youtube_id__thumbnail_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/profiles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["list_profiles_api_profiles_get"];
        put?: never;
        post: operations["create_profile_api_profiles_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/profiles/{profile_id}/cookies": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["update_cookies_api_profiles__profile_id__cookies_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/profiles/{profile_id}/unlock": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["unlock_profile_api_profiles__profile_id__unlock_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/profiles/{profile_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["delete_profile_api_profiles__profile_id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/profiles/{profile_id}/avatar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["profile_avatar_api_profiles__profile_id__avatar_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/session": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["get_session_api_session_get"];
        put?: never;
        post?: never;
        delete: operations["logout_api_session_delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/session/cookies": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["cookie_status_api_session_cookies_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/history/{video_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["record_watch_api_history__video_id__put"];
        post?: never;
        delete: operations["forget_watch_api_history__video_id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/history/progress": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["watch_progress_api_history_progress_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["history_api_history_get"];
        put?: never;
        post?: never;
        delete: operations["clear_history_api_history_delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/playlists": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["list_playlists_api_playlists_get"];
        put?: never;
        post: operations["create_playlist_api_playlists_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/playlists/{playlist_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["get_playlist_api_playlists__playlist_id__get"];
        put?: never;
        post?: never;
        delete: operations["delete_playlist_api_playlists__playlist_id__delete"];
        options?: never;
        head?: never;
        patch: operations["rename_playlist_api_playlists__playlist_id__patch"];
        trace?: never;
    };
    "/api/playlists/{playlist_id}/videos/{video_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["add_to_playlist_api_playlists__playlist_id__videos__video_id__put"];
        post?: never;
        delete: operations["remove_from_playlist_api_playlists__playlist_id__videos__video_id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auto-download/settings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["get_settings_api_auto_download_settings_get"];
        put: operations["put_settings_api_auto_download_settings_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auto-download/channels": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["list_channels_api_auto_download_channels_get"];
        put: operations["set_channels_api_auto_download_channels_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auto-download/channels/{channel_id}/pending": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["pending_videos_api_auto_download_channels__channel_id__pending_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        AutoDownloadChannelOut: {
            id: string | null;
            name: string;
            handle?: string | null;
            subscribed: boolean;
            downloaded_count: number;
            avatar_url?: string | null;
            enabled: boolean;
        };
        AutoDownloadChannelsIn: {
            channel_ids: string[];
        };
        AutoDownloadSettings: {
            max_height: number;
            start_time?: string | null;
            per_channel: number;
        };
        ChannelDetail: {
            id: string;
            known: boolean;
            refreshing: boolean;
            name: string;
            handle: string | null;
            description: string | null;
            subscriber_count: number | null;
            subscribed: boolean;
            avatar_url: string | null;
            banner_url: string | null;
            youtube_url: string;
            online: boolean;
            latest: components["schemas"]["RemoteVideoOut"][];
            latest_fetched_at: string | null;
            downloaded: components["schemas"]["VideoOut"][];
        };
        ChannelList: {
            syncing: boolean;
            items: components["schemas"]["ChannelOut"][];
        };
        ChannelOut: {
            id: string | null;
            name: string;
            handle?: string | null;
            subscribed: boolean;
            downloaded_count: number;
            avatar_url?: string | null;
        };
        CookieStatusOut: {
            cookies_valid: boolean | null;
            cookies_checked_at: string | null;
        };
        CookiesIn: {
            cookies: string;
        };
        DownloadCreate: {
            url: string;
            max_height?: number | null;
            start_at?: string | null;
            title?: string | null;
        };
        DownloadJobOut: {
            id: string;
            url: string;
            youtube_id: string | null;
            status: components["schemas"]["JobStatus"];
            progress: number;
            speed: string | null;
            eta: string | null;
            error: string | null;
            title: string | null;
            max_height: number | null;
            start_at?: string | null;
            duration_seconds: number | null;
            size_bytes: number | null;
            video_id: string | null;
            created_at: string;
            updated_at: string;
            readonly thumbnail_url: string | null;
        };
        HTTPValidationError: {
            detail?: components["schemas"]["ValidationError"][];
        };
        HistoryEntryOut: {
            video: components["schemas"]["VideoOut"];
            watched_at: string;
            position: number;
            duration: number | null;
        };
        HistoryPage: {
            items: components["schemas"]["HistoryEntryOut"][];
            total: number;
        };
        JobStatus: "queued" | "downloading" | "processing" | "completed" | "failed" | "cancelled";
        PendingVideos: {
            channel: components["schemas"]["ChannelOut"];
            videos: components["schemas"]["RemoteVideoOut"][];
        };
        PinIn: {
            pin: string;
        };
        PlaylistDetail: {
            id: string;
            name: string;
            kind: components["schemas"]["PlaylistKind"];
            count: number;
            thumbnail_url: string | null;
            updated_at: string;
            contains?: boolean | null;
            items: components["schemas"]["PlaylistItemOut"][];
            duration_seconds: number;
        };
        PlaylistIn: {
            name: string;
        };
        PlaylistItemOut: {
            video: components["schemas"]["VideoOut"];
            added_at: string;
        };
        PlaylistKind: "watch_later" | "liked" | "custom";
        PlaylistOut: {
            id: string;
            name: string;
            kind: components["schemas"]["PlaylistKind"];
            count: number;
            thumbnail_url: string | null;
            updated_at: string;
            contains?: boolean | null;
        };
        ProfileCreate: {
            cookies: string;
            name: string;
            pin: string;
        };
        ProfileOut: {
            id: string;
            name: string;
            avatar_url: string | null;
            youtube_name: string | null;
        };
        QualityOut: {
            height: number;
            size_bytes: number | null;
        };
        RemoteVideoOut: {
            youtube_id: string;
            title: string;
            duration_seconds: number | null;
            view_count: number | null;
            published_at: string | null;
            thumbnail_url: string | null;
            youtube_url: string;
            video_id?: string | null;
        };
        RemoteVideoPage: {
            items: components["schemas"]["RemoteVideoOut"][];
            has_more: boolean;
        };
        StatusOut: {
            online: boolean;
            reachable: boolean;
            forced_offline: boolean;
            checked_at: string | null;
        };
        StatusUpdate: {
            forced_offline: boolean;
        };
        ValidationError: {
            loc: (string | number)[];
            msg: string;
            type: string;
            input?: unknown;
            ctx?: Record<string, never>;
        };
        VideoFormatsOut: {
            youtube_id: string;
            title: string;
            channel: string | null;
            duration_seconds: number | null;
            qualities: components["schemas"]["QualityOut"][];
            default_height: number | null;
            video_id: string | null;
        };
        VideoOut: {
            id: string;
            youtube_id: string;
            title: string;
            description: string;
            youtube_url: string;
            channel: string | null;
            channel_id: string | null;
            channel_avatar_url?: string | null;
            duration_seconds: number | null;
            file_size: number | null;
            created_at: string;
            readonly stream_url: string;
            readonly thumbnail_url: string | null;
        };
        VideoPage: {
            items: components["schemas"]["VideoOut"][];
            total: number;
        };
        WatchIn: {
            position: number;
            duration?: number | null;
        };
        WatchProgressOut: {
            video_id: string;
            position: number;
            duration: number | null;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    health_api_health_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: string;
                    };
                };
            };
        };
    };
    list_videos_api_videos_get: {
        parameters: {
            query?: {
                q?: string | null;
                channel?: string | null;
                channel_id?: string | null;
                limit?: number;
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VideoPage"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_channels_api_videos_channels_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": string[];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_video_api_videos__video_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                video_id: string;
            };
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VideoOut"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_video_api_videos__video_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                video_id: string;
            };
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    stream_video_api_videos__video_id__stream_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                video_id: string;
            };
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    video_thumbnail_api_videos__video_id__thumbnail_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                video_id: string;
            };
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    video_formats_api_downloads_formats_get: {
        parameters: {
            query: {
                url: string;
            };
            header?: never;
            path?: never;
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VideoFormatsOut"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_downloads_api_downloads_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DownloadJobOut"][];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_download_api_downloads_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DownloadCreate"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DownloadJobOut"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_download_api_downloads__job_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                job_id: string;
            };
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DownloadJobOut"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_download_api_downloads__job_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                job_id: string;
            };
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    download_thumbnail_api_downloads__job_id__thumbnail_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                job_id: string;
            };
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    retry_download_api_downloads__job_id__retry_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                job_id: string;
            };
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DownloadJobOut"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    cancel_download_api_downloads__job_id__cancel_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                job_id: string;
            };
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DownloadJobOut"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_status_api_status_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StatusOut"];
                };
            };
        };
    };
    update_status_api_status_put: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["StatusUpdate"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StatusOut"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_channels_api_channels_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ChannelList"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    sync_channels_api_channels_sync_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ChannelList"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_channel_api_channels__channel_id__get: {
        parameters: {
            query?: {
                refresh?: boolean;
            };
            header?: never;
            path: {
                channel_id: string;
            };
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ChannelDetail"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    channel_videos_api_channels__channel_id__videos_get: {
        parameters: {
            query?: {
                offset?: number;
            };
            header?: never;
            path: {
                channel_id: string;
            };
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RemoteVideoPage"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    channel_avatar_api_channels__channel_id__avatar_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                channel_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    channel_banner_api_channels__channel_id__banner_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                channel_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    channel_video_thumbnail_api_channel_videos__youtube_id__thumbnail_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                youtube_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_profiles_api_profiles_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProfileOut"][];
                };
            };
        };
    };
    create_profile_api_profiles_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProfileCreate"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProfileOut"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_cookies_api_profiles__profile_id__cookies_put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                profile_id: string;
            };
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CookiesIn"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProfileOut"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    unlock_profile_api_profiles__profile_id__unlock_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                profile_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PinIn"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProfileOut"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_profile_api_profiles__profile_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                profile_id: string;
            };
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PinIn"];
            };
        };
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    profile_avatar_api_profiles__profile_id__avatar_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                profile_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_session_api_session_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProfileOut"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    logout_api_session_delete: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    cookie_status_api_session_cookies_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CookieStatusOut"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    record_watch_api_history__video_id__put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                video_id: string;
            };
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WatchIn"];
            };
        };
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    forget_watch_api_history__video_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                video_id: string;
            };
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    watch_progress_api_history_progress_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WatchProgressOut"][];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    history_api_history_get: {
        parameters: {
            query?: {
                q?: string | null;
                limit?: number;
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HistoryPage"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    clear_history_api_history_delete: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_playlists_api_playlists_get: {
        parameters: {
            query?: {
                video_id?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlaylistOut"][];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_playlist_api_playlists_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PlaylistIn"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlaylistOut"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_playlist_api_playlists__playlist_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                playlist_id: string;
            };
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlaylistDetail"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_playlist_api_playlists__playlist_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                playlist_id: string;
            };
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    rename_playlist_api_playlists__playlist_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                playlist_id: string;
            };
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PlaylistIn"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlaylistOut"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    add_to_playlist_api_playlists__playlist_id__videos__video_id__put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                playlist_id: string;
                video_id: string;
            };
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    remove_from_playlist_api_playlists__playlist_id__videos__video_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                playlist_id: string;
                video_id: string;
            };
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_settings_api_auto_download_settings_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AutoDownloadSettings"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    put_settings_api_auto_download_settings_put: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AutoDownloadSettings"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AutoDownloadSettings"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_channels_api_auto_download_channels_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AutoDownloadChannelOut"][];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    set_channels_api_auto_download_channels_put: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AutoDownloadChannelsIn"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AutoDownloadChannelOut"][];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    pending_videos_api_auto_download_channels__channel_id__pending_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                channel_id: string;
            };
            cookie?: {
                localtube_session?: string | null;
            };
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PendingVideos"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
}
