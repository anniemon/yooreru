1. FK 수정/삭제 시 정책은 기본 RESTRICT로 합니다.
2. 인덱스는 필요할 때에만 추가합니다. 선제적으로 추가하지 않습니다.
3. 컬럼은 필요할 때에만 추가합니다. 선제적으로 추가하지 않습니다.
4. id는 int auto increment로 합니다.
5. timestamp 관련 컬럼에는 timestamptz를 씁니다.
