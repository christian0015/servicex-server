// scripts/seedData.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Client = require('../models/client.model');
const ServiceProvider = require('../models/serviceProvider.model');
require('dotenv').config();

class DataSeeder {
  constructor() {
    this.cities = ['Kinshasa', 'Lubumbashi', 'Brazzaville', 'Libreville', 'Yamoussoukro', 'Abidjan'];
    this.zones = [
      'Gombe', 'Kalamu', 'Lingwala', 'Bandal', 'Ma Campagne', 
      'Plateau', 'Akanda', 'Owendo', 'Yopougon', 'Cocody', 'Treichville'
    ];
    
    this.services = [
      // Services standards
      { label: 'Ménage', price: 15000, isCustom: false },
      { label: 'Jardinage', price: 20000, isCustom: false },
      { label: 'Babysitting', price: 10000, isCustom: false },
      { label: 'Cuisine', price: 12000, isCustom: false },
      { label: 'Réparation électrique', price: 25000, isCustom: false },
      { label: 'Plomberie', price: 30000, isCustom: false },
      { label: 'Coiffure à domicile', price: 8000, isCustom: false },
      { label: 'Cours particuliers', price: 15000, isCustom: false },
      
      // Services custom
      { label: 'Organisation événementielle', price: 50000, isCustom: true },
      { label: 'Décoration intérieure', price: 45000, isCustom: true },
      { label: 'Garde de personnes âgées', price: 18000, isCustom: true },
      { label: 'Livraison express', price: 7000, isCustom: true },
      { label: 'Installation électroménager', price: 15000, isCustom: true }
    ];

    this.firstNames = [
      'Jean', 'Marie', 'Pierre', 'Julie', 'Marc', 'Sophie', 'Paul', 'Alice', 'Luc', 'Isabelle',
      'David', 'Sarah', 'Jacques', 'Nadia', 'Michel', 'Grace', 'André', 'Chantal', 'Roger', 'Esther',
      'Patrick', 'Rachel', 'Joseph', 'Micheline', 'Daniel', 'Pascale', 'Romain', 'Gisèle', 'Serge', 'Monique'
    ];

    this.lastNames = [
      'Kabasele', 'Mbala', 'Ngoma', 'Tshibanda', 'Mulumba', 'Kanku', 'Lubamba', 'Mbuyi', 'Ntumba', 'Kalala',
      'Diop', 'Traore', 'Kone', 'Sarr', 'Diallo', 'Ba', 'Fall', 'Gueye', 'Ndiaye', 'Sow',
      'Bongo', 'Mba', 'Nguema', 'Obiang', 'Biogo', 'Mabiala', 'Okou', 'Yao', 'Kouame', 'Toure'
    ];

    this.profilePhotos = [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=150&h=150&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?w=150&h=150&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1552058544-f2b08422138a?w=150&h=150&fit=crop&crop=face'
    ];
  }

  async connectDB() {
    try {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/servicex');
      console.log('✅ Connecté à la base de données');
    } catch (error) {
      console.error('❌ Erreur connexion DB:', error);
      process.exit(1);
    }
  }

  async disconnectDB() {
    await mongoose.disconnect();
    console.log('✅ Déconnecté de la base de données');
  }

  generatePhoneNumber(start, index) {
    const base = start.toString();
    const number = (parseInt(base) + index).toString();
    return number.padStart(base.length, '0');
  }

  getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  getRandomElements(array, count) {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  generateAvailability() {
    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    const availableDays = this.getRandomElements(days, Math.floor(Math.random() * 5) + 2);
    
    return availableDays.map(day => ({
      day,
      timeSlots: [
        {
          from: '08:00',
          to: '12:00'
        },
        {
          from: '14:00', 
          to: '18:00'
        }
      ]
    }));
  }

  generateRating() {
    const average = 3 + Math.random() * 2; // 3.0 - 5.0
    const totalVotes = Math.floor(Math.random() * 50);
    
    return {
      average: parseFloat(average.toFixed(1)),
      totalVotes,
      reviews: []
    };
  }

  generateProfileStats() {
    const totalViews = Math.floor(Math.random() * 1000);
    
    return {
      totalViews,
      weeklyViews: [],
      recentViews: [],
      bestWeek: {
        weekStart: new Date(),
        viewCount: Math.floor(Math.random() * 100)
      }
    };
  }

  async generateProviders() {
    console.log('🎯 Génération des prestataires...');
    
    const providers = [];
    const phoneStart = 88022001;
    
    for (let i = 0; i < 60; i++) {
      const firstName = this.getRandomElement(this.firstNames);
      const lastName = this.getRandomElement(this.lastNames);
      
      const provider = {
        fullName: `${firstName} ${lastName}`,
        phoneNumber: this.generatePhoneNumber(phoneStart, i),
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
        password: await bcrypt.hash('12345678', 10),
        emailConfirmed: true,
        profilePhoto: this.getRandomElement(this.profilePhotos),
        description: `Service professionnel de qualité proposé par ${firstName}. Expérimenté et fiable.`,
        services: this.getRandomElements(this.services, Math.floor(Math.random() * 3) + 1),
        availability: this.generateAvailability(),
        zones: this.getRandomElements(this.zones, Math.floor(Math.random() * 2) + 1),
        currentStatus: {
          status: this.getRandomElement(['available', 'busy', 'offline', 'on_break']),
          lastUpdated: new Date(),
          autoUpdate: Math.random() > 0.5
        },
        profileStats: this.generateProfileStats(),
        contactCount: Math.floor(Math.random() * 100),
        whatsappVerified: Math.random() > 0.3,
        isActive: true,
        rating: this.generateRating(),
        gamification: {
          badges: [],
          points: {
            total: Math.floor(Math.random() * 1000),
            weekly: Math.floor(Math.random() * 100),
            monthly: Math.floor(Math.random() * 300)
          },
          ranking: {
            weekly: Math.floor(Math.random() * 100) + 1,
            monthly: Math.floor(Math.random() * 100) + 1,
            category: Math.floor(Math.random() * 50) + 1
          },
          streaks: {
            response: Math.floor(Math.random() * 30),
            completion: Math.floor(Math.random() * 20)
          }
        },
        createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
        lastLogin: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
      };

      providers.push(provider);
    }

    await ServiceProvider.deleteMany({
      phoneNumber: { $regex: /^88022/ }
    });

    await ServiceProvider.insertMany(providers);
    console.log(`✅ ${providers.length} prestataires générés`);
    
    return providers;
  }

  async generateClients() {
    console.log('🎯 Génération des clients...');
    
    const clients = [];
    const phoneStart = 88022100;
    
    for (let i = 0; i < 30; i++) {
      const firstName = this.getRandomElement(this.firstNames);
      const lastName = this.getRandomElement(this.lastNames);
      
      const client = {
        fullName: `${firstName} ${lastName}`,
        phoneNumber: this.generatePhoneNumber(phoneStart, i),
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
        password: await bcrypt.hash('12345678', 10),
        emailConfirmed: true,
        profilePhoto: this.getRandomElement(this.profilePhotos),
        address: {
          street: `Rue ${Math.floor(Math.random() * 100)}`,
          city: this.getRandomElement(this.cities),
          zone: this.getRandomElement(this.zones)
        },
        subscription: {
          planType: this.getRandomElement(['free', 'premium_monthly', 'premium_yearly']),
          startDate: new Date(),
          status: 'active',
          autoRenew: Math.random() > 0.5,
          features: {
            unlimitedContacts: Math.random() > 0.7,
            prioritySupport: Math.random() > 0.7,
            advancedSearch: Math.random() > 0.7,
            noAds: Math.random() > 0.7
          }
        },
        activity: {
          contactsMade: [],
          profilesViewed: [],
          stats: {
            totalContacts: Math.floor(Math.random() * 20),
            totalViews: Math.floor(Math.random() * 50),
            favoriteCategories: this.getRandomElements(
              ['Ménage', 'Jardinage', 'Babysitting', 'Cuisine', 'Réparation'], 
              3
            ),
            lastActive: new Date()
          }
        },
        behavioralPreferences: {
          frequentSearches: [],
          preferredTimeSlots: [],
          budgetPatterns: {
            average: 15000,
            min: 5000,
            max: 50000
          },
          reliabilityPreferences: {
            minRating: 4.0,
            requireVerification: true,
            preferredResponseTime: 60
          }
        },
        favorites: [],
        searchHistory: [],
        preferences: {
          notifications: {
            email: true,
            sms: true,
            push: true
          },
          language: 'fr',
          preferredZones: this.getRandomElements(this.zones, 2),
          budgetRange: {
            min: 5000,
            max: 30000
          }
        },
        emailVerified: true,
        phoneVerified: true,
        createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
        lastLogin: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
      };

      clients.push(client);
    }

    await Client.deleteMany({
      phoneNumber: { $regex: /^88022/ }
    });

    await Client.insertMany(clients);
    console.log(`✅ ${clients.length} clients générés`);
    
    return clients;
  }

  async generateFakeData() {
    try {
      await this.connectDB();
      
      console.log('🚀 Début de la génération des données fictives...');
      
      await this.generateProviders();
      await this.generateClients();
      
      console.log('🎉 Génération des données fictives terminée!');
      
    } catch (error) {
      console.error('❌ Erreur lors de la génération:', error);
    } finally {
      await this.disconnectDB();
    }
  }

  async deleteFakeData() {
    try {
      await this.connectDB();
      
      console.log('🗑️ Suppression des données fictives...');
      
      const providerResult = await ServiceProvider.deleteMany({
        phoneNumber: { $regex: /^88022/ }
      });
      
      const clientResult = await Client.deleteMany({
        phoneNumber: { $regex: /^88022/ }
      });
      
      console.log(`✅ ${providerResult.deletedCount} prestataires supprimés`);
      console.log(`✅ ${clientResult.deletedCount} clients supprimés`);
      console.log('🗑️ Suppression des données fictives terminée!');
      
    } catch (error) {
      console.error('❌ Erreur lors de la suppression:', error);
    } finally {
      await this.disconnectDB();
    }
  }
}

// Exportez la classe, pas une instance
module.exports = DataSeeder;

// Pour l'utilisation en ligne de commande, créez une instance et exécutez
if (require.main === module) {
  const seeder = new DataSeeder();
  const command = process.argv[2];

  if (command === 'generate') {
    seeder.generateFakeData();
  } else if (command === 'delete') {
    seeder.deleteFakeData();
  } else {
    console.log(`
Utilisation:
  node seedData.js generate    # Générer les données fictives
  node seedData.js delete      # Supprimer les données fictives
    `);
  }
}