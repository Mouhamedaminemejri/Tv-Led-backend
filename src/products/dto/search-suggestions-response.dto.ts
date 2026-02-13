export class SearchSuggestionProductDto {
  id: string;
  title: string;
  reference: string;
  brand: string;
  price: number;
  salePrice: number | null;
  stock: number;
  tvSizeInch: number | null;
  image: string | null;
  matchedBy: string[];
}

export class SearchSuggestionsResponseDto {
  brands: string[];
  references: string[];
  titles: string[];
  models: string[];
  tvPanelTypes: string[];
  suks: string[];
  products: SearchSuggestionProductDto[];
}

