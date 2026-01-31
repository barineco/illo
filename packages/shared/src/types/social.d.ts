export interface Like {
    id: string;
    userId: string;
    artworkId: string;
    createdAt: Date;
}
export interface Bookmark {
    id: string;
    userId: string;
    artworkId: string;
    isPublic: boolean;
    createdAt: Date;
}
export interface Comment {
    id: string;
    artworkId: string;
    userId: string;
    content: string;
    parentId: string | null;
    createdAt: Date;
    updatedAt: Date;
}
export interface CommentWithUser extends Comment {
    user: {
        id: string;
        username: string;
        displayName: string | null;
        avatarUrl: string | null;
    };
    replies?: CommentWithUser[];
    replyCount: number;
}
export interface Follow {
    id: string;
    followerId: string;
    followingId: string;
    createdAt: Date;
}
export interface CreateCommentDto {
    artworkId: string;
    content: string;
    parentId?: string;
}
export interface UpdateCommentDto {
    content: string;
}
export interface ToggleLikeDto {
    artworkId: string;
}
export interface ToggleBookmarkDto {
    artworkId: string;
    isPublic?: boolean;
}
export interface ToggleFollowDto {
    userId: string;
}
