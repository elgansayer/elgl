import { IsString, IsNotEmpty, IsInt, Min, IsOptional } from 'class-validator';

export class AddToCartDto {
  @IsString()
  @IsNotEmpty()
  itemId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity: number = 1;
}
