import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v2 as cloudinary } from 'cloudinary';
import { PropertyImage } from '../properties/entities/property-image.entity';
import { PropertiesService } from '../properties/properties.service';

@Injectable()
export class MediaService {
  constructor(
    @InjectRepository(PropertyImage)
    private readonly imageRepository: Repository<PropertyImage>,
    private readonly propertiesService: PropertiesService,
  ) {}

  async uploadImages(propertyId: string, files: Express.Multer.File[]): Promise<PropertyImage[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    const property = await this.propertiesService.findOne(propertyId);
    const existingCount = property.images?.length || 0;

    if (existingCount + files.length > 8) {
      throw new BadRequestException(`A property can have a maximum of 8 images. Currently has ${existingCount}.`);
    }

    const uploadedImages: PropertyImage[] = [];

    for (const file of files) {
      const result = await new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: `rentfinda/properties/${propertyId}`,
            resource_type: 'image',
            transformation: [{ width: 1200, height: 800, crop: 'limit', quality: 'auto' }],
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          },
        );
        uploadStream.end(file.buffer);
      });

      const isPrimary = existingCount === 0 && uploadedImages.length === 0;

      const image = this.imageRepository.create({
        url: result.secure_url,
        publicId: result.public_id,
        isPrimary,
        property,
      });

      uploadedImages.push(await this.imageRepository.save(image));
    }

    return uploadedImages;
  }

  async setPrimaryImage(propertyId: string, imageId: string): Promise<PropertyImage> {
    const property = await this.propertiesService.findOne(propertyId);

    // remove primary from all images of this property
    await this.imageRepository
      .createQueryBuilder()
      .update(PropertyImage)
      .set({ isPrimary: false })
      .where('property_id = :propertyId', { propertyId: property.id })
      .execute();

    const image = await this.imageRepository.findOne({ where: { id: imageId } });
    if (!image) throw new NotFoundException('Image not found');

    image.isPrimary = true;
    return this.imageRepository.save(image);
  }

  async deleteImage(propertyId: string, imageId: string): Promise<{ message: string }> {
    await this.propertiesService.findOne(propertyId); // ensure property exists

    const image = await this.imageRepository.findOne({ where: { id: imageId } });
    if (!image) throw new NotFoundException('Image not found');

    // delete from Cloudinary
    await cloudinary.uploader.destroy(image.publicId);

    // delete from DB
    await this.imageRepository.remove(image);

    return { message: 'Image deleted successfully' };
  }
}