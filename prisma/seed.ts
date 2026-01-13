import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Start seeding...');

    const products = [
        {
            id: "1",
            title: "LED Backlight Kit for LG 32\" LN Collection",
            brand: "LG",
            reference: "LC320DXE",
            size: 32,
            price: 45.00,
            stock: 12,
            rating: 5,
            images: [
                "/led-product.png",
                "/led-product.png",
                "/led-product.png",
                "/led-product.png"
            ],
            tags: ["Best Seller", "Original"]
        },
        {
            id: "2",
            title: "Samsung UE43NU7100 Diffuser Bar Set",
            brand: "Samsung",
            reference: "V8N4-430SM0",
            size: 43,
            price: 89.99,
            stock: 4,
            rating: 4,
            images: [
                "/led-product.png",
                "/led-product.png",
                "/led-product.png"
            ],
            tags: ["Low Stock"]
        },
        {
            id: "3",
            title: "Universal LED Strip Set (Adjustable) - 50pc",
            brand: "Universal",
            reference: "UNI-LED-50",
            size: 0,
            price: 120.00,
            stock: 50,
            rating: 5,
            images: [
                "/led-product.png",
                "/led-product.png",
                "/led-product.png",
                "/led-product.png",
                "/led-product.png"
            ],
            tags: ["Technician Choice"]
        },
        {
            id: "4",
            title: "Sony Bravia KDL-40 LED Array Replacement",
            brand: "Sony",
            reference: "SVG400A81",
            size: 40,
            price: 65.50,
            stock: 0,
            rating: 4,
            images: [
                "/led-product.png",
                "/led-product.png",
                "/led-product.png"
            ],
            tags: ["Out of Stock"]
        },
        {
            id: "5",
            title: "TCL 55\" 4K Backlight Module",
            brand: "TCL",
            reference: "4C-LB5508",
            size: 55,
            price: 72.00,
            stock: 8,
            rating: 5,
            images: [
                "/led-product.png",
                "/led-product.png",
                "/led-product.png",
                "/led-product.png"
            ],
            tags: ["New"]
        },
        {
            id: "6",
            title: "Philips Ambilight Strip Replacement",
            brand: "Philips",
            reference: "PH-AMB-01",
            size: 50,
            price: 55.00,
            stock: 15,
            rating: 4,
            images: [
                "/led-product.png",
                "/led-product.png",
                "/led-product.png"
            ],
            tags: []
        },
        {
            id: "7",
            title: "LG 42\" LED Backlight Strip Kit",
            brand: "LG",
            reference: "LC420LED-STRIP",
            size: 42,
            price: 58.50,
            stock: 20,
            rating: 5,
            images: [
                "/led-product.png",
                "/led-product.png",
                "/led-product.png",
                "/led-product.png"
            ],
            tags: ["Best Seller", "Premium"]
        },
        {
            id: "8",
            title: "Samsung 50\" Edge-Lit LED Bar Set",
            brand: "Samsung",
            reference: "SM50-EDGE-LED",
            size: 50,
            price: 95.00,
            stock: 7,
            rating: 4,
            images: [
                "/led-product.png",
                "/led-product.png",
                "/led-product.png"
            ],
            tags: ["Premium Quality"]
        },
        {
            id: "9",
            title: "Hisense 43\" Direct-Lit LED Array",
            brand: "Hisense",
            reference: "HS43-DL-ARRAY",
            size: 43,
            price: 62.00,
            stock: 18,
            rating: 4,
            images: [
                "/led-product.png",
                "/led-product.png",
                "/led-product.png",
                "/led-product.png",
                "/led-product.png"
            ],
            tags: ["New", "Value"]
        },
        {
            id: "10",
            title: "Panasonic 49\" LED Backlight Module",
            brand: "Panasonic",
            reference: "PN49-LED-MOD",
            size: 49,
            price: 78.00,
            stock: 10,
            rating: 5,
            images: [
                "/led-product.png",
                "/led-product.png",
                "/led-product.png"
            ],
            tags: ["Original", "High Quality"]
        },
        {
            id: "11",
            title: "Vizio 55\" Full Array LED Kit",
            brand: "Vizio",
            reference: "VZ55-FA-LED",
            size: 55,
            price: 105.00,
            stock: 5,
            rating: 5,
            images: [
                "/led-product.png",
                "/led-product.png",
                "/led-product.png",
                "/led-product.png"
            ],
            tags: ["Premium", "Full Array"]
        },
        {
            id: "12",
            title: "Sharp 40\" LED Strip Replacement Set",
            brand: "Sharp",
            reference: "SH40-LED-STRIP",
            size: 40,
            price: 68.00,
            stock: 14,
            rating: 4,
            images: [
                "/led-product.png",
                "/led-product.png",
                "/led-product.png"
            ],
            tags: ["Original"]
        },
        {
            id: "13",
            title: "Toshiba 32\" LED Backlight Bar",
            brand: "Toshiba",
            reference: "TS32-LED-BAR",
            size: 32,
            price: 48.00,
            stock: 22,
            rating: 4,
            images: [
                "/led-product.png",
                "/led-product.png",
                "/led-product.png",
                "/led-product.png"
            ],
            tags: ["Best Seller", "Budget Friendly"]
        },
        {
            id: "14",
            title: "Sony 65\" 4K LED Array Module",
            brand: "Sony",
            reference: "SN65-4K-LED",
            size: 65,
            price: 145.00,
            stock: 3,
            rating: 5,
            images: [
                "/led-product.png",
                "/led-product.png",
                "/led-product.png",
                "/led-product.png",
                "/led-product.png"
            ],
            tags: ["Premium", "4K", "Large Screen"]
        },
        {
            id: "15",
            title: "LG 58\" OLED Backlight Strip",
            brand: "LG",
            reference: "LC58-OLED-STRIP",
            size: 58,
            price: 125.00,
            stock: 6,
            rating: 5,
            images: [
                "/led-product.png",
                "/led-product.png",
                "/led-product.png"
            ],
            tags: ["OLED", "Premium"]
        },
        {
            id: "16",
            title: "Samsung 60\" QLED LED Bar Set",
            brand: "Samsung",
            reference: "SM60-QLED-LED",
            size: 60,
            price: 165.00,
            stock: 4,
            rating: 5,
            images: [
                "/led-product.png",
                "/led-product.png",
                "/led-product.png",
                "/led-product.png"
            ],
            tags: ["QLED", "Premium", "Large Screen"]
        },
        {
            id: "17",
            title: "Universal 32-55\" Adjustable LED Strip",
            brand: "Universal",
            reference: "UNI-32-55-ADJ",
            size: 0,
            price: 75.00,
            stock: 35,
            rating: 4,
            images: [
                "/led-product.png",
                "/led-product.png",
                "/led-product.png",
                "/led-product.png"
            ],
            tags: ["Universal", "Adjustable", "Versatile"]
        },
        {
            id: "18",
            title: "TCL 43\" Roku TV LED Backlight",
            brand: "TCL",
            reference: "TCL43-ROKU-LED",
            size: 43,
            price: 69.00,
            stock: 12,
            rating: 4,
            images: [
                "/led-product.png",
                "/led-product.png",
                "/led-product.png"
            ],
            tags: ["Roku TV", "Compatible"]
        },
        {
            id: "19",
            title: "Philips 48\" Ambilight Plus LED Strip",
            brand: "Philips",
            reference: "PH48-AMB-PLUS",
            size: 48,
            price: 88.00,
            stock: 9,
            rating: 5,
            images: [
                "/led-product.png",
                "/led-product.png",
                "/led-product.png",
                "/led-product.png"
            ],
            tags: ["Ambilight", "Premium"]
        },
        {
            id: "20",
            title: "Panasonic 37\" LED Backlight Kit",
            brand: "Panasonic",
            reference: "PN37-LED-KIT",
            size: 37,
            price: 52.00,
            stock: 16,
            rating: 4,
            images: [
                "/led-product.png",
                "/led-product.png",
                "/led-product.png"
            ],
            tags: ["Compact", "Value"]
        }
    ];

    for (const product of products) {
        const created = await prisma.product.upsert({
            where: { id: product.id },
            update: {},
            create: product,
        });
        console.log(`Created product: ${created.title}`);
    }

    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
