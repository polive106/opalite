export interface BitbucketUser {
  display_name: string;
  nickname: string;
}

export interface BitbucketParticipant {
  user: BitbucketUser;
  role: "PARTICIPANT" | "REVIEWER" | "AUTHOR";
  approved: boolean;
  state: "approved" | "changes_requested" | null;
}

export interface BitbucketPR {
  id: number;
  title: string;
  description: string;
  state: "OPEN" | "MERGED" | "DECLINED" | "SUPERSEDED";
  source: {
    branch: { name: string };
    repository: { full_name: string };
  };
  destination: {
    branch: { name: string };
  };
  author: BitbucketUser;
  participants: BitbucketParticipant[];
  comment_count: number;
  created_on: string;
  updated_on: string;
  links: {
    diff: { href: string };
    html: { href: string };
  };
}

export interface BitbucketComment {
  id: number;
  content: { raw: string; markup: string; html: string };
  user: BitbucketUser;
  created_on: string;
  updated_on: string;
  inline?: {
    path: string;
    from?: number;
    to?: number;
  };
  parent?: { id: number };
  deleted: boolean;
  resolved?: boolean;
}

export interface PaginatedResponse<T> {
  values: T[];
  next?: string;
  page?: number;
  size?: number;
}
