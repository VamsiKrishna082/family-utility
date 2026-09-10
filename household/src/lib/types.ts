export type Entry = {
  id: string;
  name: string;
  kind: "folder" | "photo" | "video";
  width: number | null;
  height: number | null;
  durationLabel: string | null;
  createdTime: string;
  hasThumb: boolean;
};

export type Crumb = { id: string; name: string };

export type BrowseResponse = {
  folderId: string;
  crumbs: Crumb[];
  entries: Entry[];
};
