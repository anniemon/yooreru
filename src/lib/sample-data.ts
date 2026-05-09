import { SITE } from "./constants";

export type BlogCategory = {
  id: number;
  name: string;
  slug: string;
  description: string;
  parentSlug?: string;
  postCount: number;
};

export type BlogTag = {
  id: number;
  name: string;
  slug: string;
  postCount: number;
};

export type BlogComment = {
  id: number;
  postId: number;
  parentId: number | null;
  authorName: string;
  authorEmailHash?: string;
  content: string;
  createdAt: Date;
  children?: BlogComment[];
};

export type BlogPost = {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  contentHtml: string;
  featuredImageUrl?: string | null;
  publishedAt: Date | null;
  allowComments: boolean;
  categories: BlogCategory[];
  tags: BlogTag[];
  comments?: BlogComment[];
};

export const sampleCategories: BlogCategory[] = [
  {
    id: -1,
    name: "diary",
    slug: "diary",
    description: "가끔 같은 속옷을 입기도 하는 두 여자",
    postCount: 6,
  },
  {
    id: -2,
    name: "fingertip",
    slug: "fingertip",
    description: "손가락 끝으로 스트리밍한 일기",
    parentSlug: "diary",
    postCount: 25,
  },
  {
    id: -3,
    name: "elephantrunk",
    slug: "elephantrunk",
    description: "호구 노트",
    parentSlug: "diary",
    postCount: 8,
  },
  {
    id: -4,
    name: "그네에게",
    slug: "그네에게",
    description: "",
    postCount: 0,
  },
];

export const sampleTags: BlogTag[] = [
  { id: -101, name: "최선의사랑", slug: "최선의사랑", postCount: 5 },
  { id: -102, name: "시", slug: "시", postCount: 3 },
  { id: -103, name: "일기", slug: "일기", postCount: 5 },
  { id: -104, name: "폴리아모리", slug: "폴리아모리", postCount: 2 },
];

const fingertip = sampleCategories[1];
const diary = sampleCategories[0];
const love = sampleTags[0];
const poem = sampleTags[1];
const poly = sampleTags[3];

export const samplePosts: BlogPost[] = [
  {
    id: -1001,
    title: "슬픔의 가능성",
    slug: "슬픔의-가능성",
    excerpt: "원본 WordPress export가 연결되기 전까지 보이는 샘플 게시글입니다.",
    publishedAt: new Date("2026-04-11T17:12:49+09:00"),
    allowComments: true,
    categories: [fingertip],
    tags: [poly, love],
    contentHtml: `
      <p>이 화면은 ${SITE.name}의 새 커스텀 블로그가 어떤 밀도와 호흡으로 보일지 확인하기 위한 샘플입니다.</p>
      <p>WordPress export 파일을 가져오면 실제 게시글, 카테고리, 태그, 댓글이 이 자리에 채워집니다.</p>
      <blockquote><p>같은 도메인, 같은 주소 구조, 관리 가능한 새 블로그.</p></blockquote>
    `,
    comments: [],
  },
  {
    id: -1002,
    title: "상승세",
    slug: "상승세",
    excerpt: "카테고리와 태그 목록, 월별 아카이브를 확인하기 위한 두 번째 샘플입니다.",
    publishedAt: new Date("2026-03-24T15:20:51+09:00"),
    allowComments: true,
    categories: [fingertip],
    tags: [],
    contentHtml: `
      <p>어드민에서 새 글을 발행하면 홈, RSS, 카테고리, 태그, 월별 아카이브에 자동으로 반영됩니다.</p>
    `,
    comments: [],
  },
  {
    id: -1003,
    title: "On My Exes",
    slug: "on-my-exes",
    excerpt: "영문 slug와 한국어 UI가 함께 동작하는지 확인합니다.",
    publishedAt: new Date("2026-03-07T02:20:09+09:00"),
    allowComments: true,
    categories: [fingertip],
    tags: [poly, love],
    contentHtml: `
      <p>이 프로젝트는 WordPress의 콘텐츠 모델을 참고하되, 앱 코드는 Next.js 안에서 직접 관리합니다.</p>
    `,
    comments: [],
  },
  {
    id: -1004,
    title: "Drifting",
    slug: "drifting",
    excerpt: "상위/하위 카테고리 관계를 보여주는 샘플입니다.",
    publishedAt: new Date("2026-01-28T00:38:55+09:00"),
    allowComments: true,
    categories: [diary],
    tags: [poem],
    contentHtml: `
      <p>기존 permalink를 유지하므로 검색 결과와 공유 링크가 끊기지 않도록 설계했습니다.</p>
    `,
    comments: [],
  },
];
