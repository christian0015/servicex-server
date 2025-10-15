const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');
const fs = require('fs').promises;

class EmailService {
  constructor() {
    this.transporter = null;
    this.templatesCache = new Map();
    this.initializeTransporter();
  }

  /**
   * Initialisation du transporteur email
   */
  initializeTransporter() {
    // Vérifier si la configuration SMTP existe
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('⚠️ Configuration SMTP manquante - Les emails seront loggés mais pas envoyés');
      this.isSmtpConfigured = false;
      return;
    }

    return this.isSmtpConfigured = false;
    // Désactiver SMTP pour l'instant
    console.log('📧 Service email en mode simulation (SMTP désactivé)');


    // 📧 Configuration basée sur l'environnement
    const config = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    };

    this.transporter = nodemailer.createTransport(config);
    this.isSmtpConfigured = true;

    // 🔧 Vérification de la connexion SMTP
    this.transporter.verify((error) => {
      if (error) {
        console.error('❌ Erreur configuration SMTP:', error);
        this.isSmtpConfigured = false;
      } else {
        console.log('✅ Serveur SMTP prêt');
      }
    });
  }

  /**
   * Charge un template EJS depuis le cache ou le système de fichiers
   */
  async loadTemplate(templateName, data = {}) {
    const cacheKey = `${templateName}_${JSON.stringify(data)}`;
    
    if (this.templatesCache.has(cacheKey)) {
      return this.templatesCache.get(cacheKey);
    }

    try {
      const templatePath = path.join(__dirname, 'templates', `${templateName}.ejs`);
      const templateContent = await fs.readFile(templatePath, 'utf-8');
      
      // 🎨 Compilation du template avec les données
      const compiledTemplate = ejs.render(templateContent, {
        ...data,
        currentYear: new Date().getFullYear(),
        appName: 'ServiceX',
        baseUrl: process.env.BASE_URL || 'http://localhost:3000'
      });

      this.templatesCache.set(cacheKey, compiledTemplate);
      return compiledTemplate;
      
    } catch (error) {
      console.error(`❌ Erreur chargement template ${templateName}:`, error);
      console.log("Utilisation de template de secour");
      // 🔄 Template de secours
      return this.generateFallbackTemplate(templateName, data);
      // throw new Error(`Template ${templateName} non trouvé`);
    }
  }


  /**
   * Génère un template de secours si le template principal est manquant
   */
  generateFallbackTemplate(templateName, data) {
    const fallbackTemplates = {
      'new-contact': `
        <h2>Nouvelle Demande de Contact</h2>
        <p><strong>Prestataire:</strong> ${data.providerName || 'N/A'}</p>
        <p><strong>Client:</strong> ${data.clientName || 'N/A'}</p>
        <p><strong>Service:</strong> ${data.serviceType || 'N/A'}</p>
        <p><strong>Date:</strong> ${new Date().toLocaleDateString('fr-FR')}</p>
        <p><strong>Téléphone client:</strong> ${data.clientPhone || 'N/A'}</p>
      `,
      'contact-confirmation': `
        <h2>Confirmation de Contact</h2>
        <p><strong>Client:</strong> ${data.clientName || 'N/A'}</p>
        <p><strong>Prestataire:</strong> ${data.providerName || 'N/A'}</p>
        <p><strong>Service:</strong> ${data.serviceType || 'N/A'}</p>
        <p><strong>Téléphone prestataire:</strong> ${data.providerPhone || 'N/A'}</p>
        <p>Votre demande a bien été envoyée.</p>
      `
    };

    return fallbackTemplates[templateName] || `
      <h2>Notification ServiceX</h2>
      <p>Type: ${templateName}</p>
      <p>Données: ${JSON.stringify(data)}</p>
    `;
  }


  /**
   * Envoi d'email générique
   */
  async sendEmail(options) {
    const {
      to,
      subject,
      template,
      data = {},
      attachments = [],
      replyTo,
      cc,
      bcc
    } = options;

    try {
      // 📝 Génération du contenu HTML
      const html = await this.loadTemplate(template, data);
      
      // ✉️ Configuration de l'email
      const mailOptions = {
        from: {
          name: 'ServiceX - Votre plateforme de services',
          address: process.env.SMTP_FROM || 'noreply@servicex.com'
        },
        to,
        subject,
        html,
        attachments,
        replyTo,
        cc,
        bcc
      };

      // 🚀 Envoi de l'email ou log si SMTP non configuré
      if (this.isSmtpConfigured && this.transporter) {
        const result = await this.transporter.sendMail(mailOptions);
        console.log(`✅ Email envoyé à ${to} - ${subject}`);
        return {
          success: true,
          messageId: result.messageId,
          response: result.response
        };
      } else {
        // 📋 Log l'email qui aurait été envoyé
        console.log(`📧 Email simulé (SMTP non configuré):`);
        console.log(`   À: ${to}`);
        console.log(`   Sujet: ${subject}`);
        console.log(`   Template: ${template}`);
        return {
          success: true,
          messageId: 'simulated-' + Date.now(),
          response: 'Email simulé (SMTP non configuré)'
        };
      }
      
    } catch (error) {
      console.error(`❌ Erreur envoi email à ${to}:`, error);
      throw new Error(`Échec envoi email: ${error.message}`);
    }
  }

  /**
   * Email de bienvenue pour nouveaux utilisateurs
   */
  async sendWelcomeEmail(user, userType) {
    const { email, fullName } = user;
    
    return this.sendEmail({
      to: email,
      subject: `Bienvenue sur ServiceX ${fullName} ! 🎉`,
      template: 'welcome',
      data: {
        fullName,
        userType,
        dashboardUrl: `${process.env.BASE_URL}/dashboard`,
        helpUrl: `${process.env.BASE_URL}/help`
      }
    });
  }

  /**
   * Email de vérification de compte
   */
  async sendVerificationEmail(user, verificationToken) {
    const { email, fullName } = user;
    const verificationUrl = `${process.env.BASE_URL}/verify-email?token=${verificationToken}`;

    return this.sendEmail({
      to: email,
      subject: 'Vérifiez votre adresse email - ServiceX',
      template: 'email-verification',
      data: {
        fullName,
        verificationUrl,
        expiryHours: 24
      }
    });
  }

  /**
   * Notification de nouveau contact pour prestataires
   */
  async sendNewContactNotification(provider, client, serviceType) {
    const { email, fullName: providerName } = provider;
    const { fullName: clientName, phoneNumber } = client;

    return this.sendEmail({
      to: email,
      subject: `🎯 Nouvelle demande de ${serviceType} de ${clientName}`,
      template: 'new-contact',
      data: {
        providerName,
        clientName,
        serviceType,
        clientPhone: phoneNumber,
        contactDate: new Date().toLocaleDateString('fr-FR'),
        dashboardUrl: `${process.env.BASE_URL}/provider/dashboard`
      }
    });
  }

  /**
   * Notification de confirmation de contact pour clients
   */
  async sendContactConfirmation(client, provider, serviceType) {
    const { email, fullName: clientName } = client;
    const { fullName: providerName, phoneNumber } = provider;

    return this.sendEmail({
      to: email,
      subject: `✅ Demande envoyée à ${providerName}`,
      template: 'contact-confirmation',
      data: {
        clientName,
        providerName,
        serviceType,
        providerPhone: phoneNumber,
        expectedResponse: 'sous 24 heures',
        helpUrl: `${process.env.BASE_URL}/help`
      }
    });
  }

  /**
   * Notification de nouveau avis/review
   */
  async sendNewReviewNotification(provider, client, rating, comment) {
    const { email, fullName: providerName } = provider;
    const { fullName: clientName } = client;

    return this.sendEmail({
      to: email,
      subject: `⭐ Nouvel avis de ${clientName} - ${rating}/5`,
      template: 'new-review',
      data: {
        providerName,
        clientName,
        rating,
        comment: comment || 'Aucun commentaire',
        profileUrl: `${process.env.BASE_URL}/provider/profile`,
        date: new Date().toLocaleDateString('fr-FR')
      }
    });
  }

  /**
   * Notification de promotion/abonnement
   */
  async sendSubscriptionNotification(user, planType, endDate) {
    const { email, fullName } = user;

    return this.sendEmail({
      to: email,
      subject: `🎊 Félicitations ! Votre abonnement ${this.getPlanName(planType)} est activé`,
      template: 'subscription-activated',
      data: {
        fullName,
        planName: this.getPlanName(planType),
        endDate: endDate.toLocaleDateString('fr-FR'),
        features: this.getPlanFeatures(planType),
        manageSubscriptionUrl: `${process.env.BASE_URL}/subscription`
      }
    });
  }

  /**
   * Rappel d'abonnement qui expire
   */
  async sendSubscriptionReminder(user, planType, daysLeft) {
    const { email, fullName } = user;

    return this.sendEmail({
      to: email,
      subject: `⏰ Votre abonnement expire dans ${daysLeft} jour(s)`,
      template: 'subscription-reminder',
      data: {
        fullName,
        planName: this.getPlanName(planType),
        daysLeft,
        renewUrl: `${process.env.BASE_URL}/subscription/renew`
      }
    });
  }

  /**
   * Notification de classement hebdomadaire
   */
  async sendWeeklyRankingNotification(provider, ranking, category) {
    const { email, fullName } = provider;

    return this.sendEmail({
      to: email,
      subject: `🏆 Classement hebdomadaire - Vous êtes #${ranking} en ${category}`,
      template: 'weekly-ranking',
      data: {
        fullName,
        ranking,
        category,
        performanceUrl: `${process.env.BASE_URL}/provider/analytics`,
        boostMessage: this.getRankingBoostMessage(ranking)
      }
    });
  }

  /**
   * Notification de badge débloqué
   */
  async sendBadgeUnlockedNotification(provider, badgeName, level) {
    const { email, fullName } = provider;

    return this.sendEmail({
      to: email,
      subject: `🎖️ Félicitations ! Badge "${this.getBadgeDisplayName(badgeName)}" débloqué`,
      template: 'badge-unlocked',
      data: {
        fullName,
        badgeName: this.getBadgeDisplayName(badgeName),
        level,
        badgeDescription: this.getBadgeDescription(badgeName),
        profileUrl: `${process.env.BASE_URL}/provider/profile`
      }
    });
  }

  /**
   * Email de réinitialisation de mot de passe
   */
  async sendPasswordResetEmail(user, resetToken) {
    const { email, fullName } = user;
    const resetUrl = `${process.env.BASE_URL}/reset-password?token=${resetToken}`;

    return this.sendEmail({
      to: email,
      subject: 'Réinitialisation de votre mot de passe - ServiceX',
      template: 'password-reset',
      data: {
        fullName,
        resetUrl,
        expiryMinutes: 30
      }
    });
  }

  /**
   * Newsletter/marketing
   */
  async sendNewsletter(users, subject, content) {
    const results = [];
    
    for (const user of users) {
      try {
        const result = await this.sendEmail({
          to: user.email,
          subject,
          template: 'newsletter',
          data: {
            fullName: user.fullName,
            content,
            unsubscribeUrl: `${process.env.BASE_URL}/unsubscribe?email=${user.email}`
          }
        });
        results.push({ email: user.email, success: true, result });
      } catch (error) {
        results.push({ email: user.email, success: false, error: error.message });
      }
    }

    return {
      total: users.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      details: results
    };
  }

  // 🛠️ Méthodes utilitaires

  getPlanName(planType) {
    const plans = {
      'free': 'Gratuit',
      'daily': 'Promotion Journalière',
      'monthly': 'Mensuel',
      'yearly': 'Annuel',
      'premium_monthly': 'Premium Mensuel',
      'premium_yearly': 'Premium Annuel'
    };
    return plans[planType] || planType;
  }

  getPlanFeatures(planType) {
    const features = {
      'free': ['Recherche basique', '3 contacts/semaine', 'Support standard'],
      'daily': ['Visibilité accrue 24h', 'Positionnement prioritaire'],
      'monthly': ['Visibilité permanente', 'Analytics avancées', 'Badges exclusifs'],
      'premium_monthly': ['Contacts illimités', 'Recherche avancée', 'Support prioritaire', 'Sans publicités']
    };
    return features[planType] || [];
  }

  getRankingBoostMessage(ranking) {
    if (ranking <= 3) return 'Votre profil sera mis en avant toute la semaine !';
    if (ranking <= 10) return 'Profitez d\'une visibilité accrue cette semaine.';
    return 'Continuez vos efforts pour monter dans le classement.';
  }

  getBadgeDisplayName(badgeName) {
    const badges = {
      'response_rapide': 'Réponse Rapide',
      'fiable': 'Prestataire Fiable',
      'top_note': 'Top Notes',
      'super_dispo': 'Super Disponible',
      'populaire': 'Profil Populaire',
      'top_performer': 'Top Performeur'
    };
    return badges[badgeName] || badgeName;
  }

  getBadgeDescription(badgeName) {
    const descriptions = {
      'response_rapide': 'Pour votre réactivité exceptionnelle aux demandes clients',
      'fiable': 'Reconnu pour votre fiabilité et professionnalisme',
      'top_note': 'Vos clients vous notent exceptionnellement bien',
      'super_dispo': 'Toujours disponible quand vos clients ont besoin de vous',
      'populaire': 'Votre profil attire de nombreux clients',
      'top_performer': 'Classé parmi les meilleurs prestataires de la plateforme'
    };
    return descriptions[badgeName] || 'Badge de reconnaissance ServiceX';
  }

  /**
   * Vérification de la délivrabilité email
   */
  async verifyEmail(email) {
    // 🎯 Implémentation basique - en production, utiliser un service comme Hunter.io
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Statistiques d'envoi
   */
  async getEmailStats() {
    // 📊 En production, on stockerait ces données en base
    return {
      sentToday: 0, // À implémenter avec tracking
      sentThisMonth: 0,
      deliveryRate: '98%',
      openRate: '45%'
    };
  }
}

module.exports = new EmailService();