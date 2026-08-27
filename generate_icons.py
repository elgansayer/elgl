import struct
import zlib

def make_png(width, height):
    # PNG signature
    png = b'\x89PNG\r\n\x1a\n'
    
    # IHDR chunk
    # width(4), height(4), bit depth(1), color type(1), compression(1), filter(1), interlace(1)
    # color type 6 is RGBA, bit depth 8
    ihdr_data = struct.pack('!IIBBBBB', width, height, 8, 6, 0, 0, 0)
    ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data)
    png += struct.pack('!I', len(ihdr_data)) + b'IHDR' + ihdr_data + struct.pack('!I', ihdr_crc)
    
    # IDAT chunk
    # Raw pixel data: for each row, 1 byte filter type (0) + (width * 4 bytes RGBA)
    raw_data = b'\x00' + b'\x00\x00\x00\x00' * width
    raw_data = raw_data * height
    idat_data = zlib.compress(raw_data)
    idat_crc = zlib.crc32(b'IDAT' + idat_data)
    png += struct.pack('!I', len(idat_data)) + b'IDAT' + idat_data + struct.pack('!I', idat_crc)
    
    # IEND chunk
    iend_crc = zlib.crc32(b'IEND')
    png += struct.pack('!I', 0) + b'IEND' + struct.pack('!I', iend_crc)
    
    return png

sizes = [72, 96, 128, 144, 152, 192, 384, 512]
for size in sizes:
    with open(f'frontend/public/assets/icons/icon-{size}x{size}.png', 'wb') as f:
        f.write(make_png(size, size))
