const portfolioData = {
    bio: {
        name: "Razan Muhammad Ikhsan",
        title: "Web Developer",
        description: "Halo! Saya adalah seorang developer yang selalu ngestuck di JawaScript.",
        image: "https://cihuy.biz.id/file/QcZ1qoGL.jpg",
        status: [
          { label: "Umur", value: "16" },
          { label: "Lokasi", value: "Bekasi, Indonesia" },
          { label: "Sekolah", value: "SMK Magda Nusantara" },
          { label: "Kelamin", value: "Pria" }
        ]
    },
    skills: {
    frontend: [
      { name: "Next.js", level: "75%" },
      { name: "React.js", level: "79%" },
      { name: "JavaScript", level: "85%" },
      { name: "TypeScript", level: "67%" },
      { name: "HTML5", level: "65%" },
      { name: "CSS3 & SASS", level: "32%" }
    ],
    backend: [
      { name: "Node.js", level: "89%" },
      { name: "Express.js", level: "65%" },
      { name: "MongoDB", level: "24%" },
      { name: "Supabase", level: "55%" }
    ]
  },
    projects: [
        {
            id: 1,
            title: "Zann File Host & Shortener",
            tagline: "Website file hosting and url shorten dibangun dengan Express.js dan EJS.",
            image: "https://file.noku.top/yesW.png",
            url: "https://zann.my.id"
        },
        {
            id: 2,
            title: "Website Deployer",
            tagline: "Website Deployer Dibangun dengan React.js.",
            image: "https://cihuy.biz.id/file/PwYUFLGq.png",
            url: "https://noku.top"
        },
        {
            id: 3,
            title: "Website Anime Streaming",
            tagline: "Website Anime Streaming Dibangun dengan React.js TypeScript dan Tailwind CSS.",
            image: "https://cihuy.biz.id/file/j5BsQbJV.png",
            url: "https://zannime.zone.id"
        },
        {
            id: 4,
            title: "Website Kelas",
            tagline: "Website Kelas Dibangun dengan React.js JavaScript dan Tailwind CSS.",
            image: "https://cihuy.biz.id/file/vIFwcJFB.png",
            url: "https://nettwo.zone.id"
        }
    ],
    contact: {
        email: "cihuy@zann.my.id",
        github: "zannbjir",
        instagram: "razanaja.cuy",
        facebook: "zannnyx"
    }
};

module.exports = portfolioData;