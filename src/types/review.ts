export interface PR {
  id: number;
  title: string;
  description: string;
  sourceBranch: string;
  destinationBranch: string;
  author: {
    displayName: string;
    nickname: string;
  };
  repo: string;
  commentCount: number;
  createdOn: Date;
  updatedOn: Date;
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  url: string;
  participants: Participant[];
}

export interface Participant {
  displayName: string;
  nickname: string;
  role: "PARTICIPANT" | "REVIEWER" | "AUTHOR";
  approved: boolean;
  state: "approved" | "changes_requested" | null;
}

export interface RepoGroup {
  repo: string;
  prs: PR[];
}

export interface Comment {
  id: number;
  author: {
    displayName: string;
    nickname: string;
  };
  content: string;
  createdOn: Date;
  isInline: boolean;
  filePath?: string;
  lineNumber?: number;
  resolved: boolean;
  deleted: boolean;
  parentId?: number;
  replies: Comment[];
}
