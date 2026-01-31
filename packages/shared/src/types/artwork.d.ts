export declare enum ArtworkType {
    ILLUSTRATION = "ILLUSTRATION",
    MANGA = "MANGA"
}
export declare enum AgeRating {
    ALL_AGES = "ALL_AGES",
    R18 = "R18",
    R18G = "R18G"
}
export interface Artwork {
    id: string;
    title: string;
    description: string | null;
    type: ArtworkType;
    ageRating: AgeRating;
    authorId: string;
    viewCount: number;
    likeCount: number;
    bookmarkCount: number;
    commentCount: number;
    createdAt: Date;
    updatedAt: Date;
    publishedAt: Date | null;
}
export interface ArtworkImage {
    id: string;
    artworkId: string;
    url: string;
    thumbnailUrl: string;
    width: number;
    height: number;
    order: number;
    storageKey: string;
    fileSize: number;
    mimeType: string;
    createdAt: Date;
}
export interface Tag {
    id: string;
    name: string;
    artworkCount: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface ArtworkWithDetails extends Artwork {
    images: ArtworkImage[];
    tags: Tag[];
    author: {
        id: string;
        username: string;
        displayName: string | null;
        avatarUrl: string | null;
    };
    isLiked?: boolean;
    isBookmarked?: boolean;
}
export interface CreateArtworkDto {
    title: string;
    description?: string;
    type: ArtworkType;
    ageRating: AgeRating;
    tags: string[];
}
export interface UpdateArtworkDto {
    title?: string;
    description?: string;
    ageRating?: AgeRating;
    tags?: string[];
}
export interface PaginatedArtworks {
    artworks: ArtworkWithDetails[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
}
