<?php

namespace MediaWiki\Extension\UploadWizard;

use DatabaseUpdater;
use RequestContext;
use User;

class Hooks {

	/**
	 * Schema update to set up the needed database tables.
	 *
	 * @since 1.2
	 *
	 * @param DatabaseUpdater|null $updater
	 *
	 * @return true
	 */
	public static function onSchemaUpdate( /* DatabaseUpdater */ $updater = null ) {
		$type = $updater->getDB()->getType();
		$path = dirname( __DIR__ ) . '/sql/';

		$updater->addExtensionTable( 'uw_campaigns', "$path/$type/tables-generated.sql" );

		// 1.38
		$updater->modifyExtensionField(
			'uw_campaigns',
			'uw_campaigns_enabled',
			"$path/$type/patch-uw_campaigns-cleanup.sql"
		);

		return true;
	}

	/**
	 * Adds the preferences of UploadWizard to the list of available ones.
	 * @see https://www.mediawiki.org/wiki/Manual:Hooks/GetPreferences
	 *
	 * @since 1.2
	 *
	 * @param User $user
	 * @param array &$preferences
	 *
	 * @return true
	 */
	public static function onGetPreferences( User $user, array &$preferences ) {
		$config = Config::getConfig();

		// User preference to skip the licensing tutorial, provided it's not globally disabled
		if ( Config::getSetting( 'tutorial' ) != [] ) {
			$preferences['upwiz_skiptutorial'] = [
				'type' => 'check',
				'label-message' => 'mwe-upwiz-prefs-skiptutorial',
				'section' => 'uploads/upwiz-interface'
			];
		}

		$preferences['upwiz_licensename'] = [
			'type' => 'text',
			'label-message' => 'mwe-upwiz-prefs-license-name',
			'help-message' => 'mwe-upwiz-prefs-license-name-help',
			'section' => 'uploads/upwiz-licensing'
		];

		if ( Config::getSetting( 'enableLicensePreference' ) ) {
			$licenseConfig = Config::getSetting( 'licenses' );

			$licenses = [];

			$licensingOptions = Config::getSetting( 'licensing' );

			$ownWork = $licensingOptions['ownWork'];
			foreach ( $ownWork['licenses'] as $license ) {
				$licenseMessage = self::getLicenseMessage( $license, $licenseConfig );
				$licenseKey = wfMessage( 'mwe-upwiz-prefs-license-own' )
					->rawParams( $licenseMessage )->escaped();
				$licenseValue = htmlspecialchars( 'ownwork-' . $license, ENT_QUOTES, 'UTF-8', false );
				$licenses[$licenseKey] = $licenseValue;
			}

			$thirdParty = Config::getThirdPartyLicenses();
			$hasCustom = false;
			foreach ( $thirdParty as $license ) {
				if ( $license !== 'custom' ) {
					$licenseMessage = self::getLicenseMessage( $license, $licenseConfig );
					$licenseKey = wfMessage( 'mwe-upwiz-prefs-license-thirdparty' )
						->rawParams( $licenseMessage )->escaped();
					$licenseValue = htmlspecialchars( 'thirdparty-' . $license, ENT_QUOTES, 'UTF-8', false );
					$licenses[$licenseKey] = $licenseValue;
				} else {
					$hasCustom = true;
				}
			}

			$licenses = array_merge(
				[
					wfMessage( 'mwe-upwiz-prefs-def-license-def' )->escaped() => 'default'
				],
				$licenses
			);

			if ( $hasCustom ) {
				// The "custom license" option must be last, otherwise the text referring to "following
				// wikitext" and "last option above" makes no sense.
				$licenseMessage = self::getLicenseMessage( 'custom', $licenseConfig );
				$licenseKey = wfMessage( 'mwe-upwiz-prefs-license-thirdparty' )
					->rawParams( $licenseMessage )->escaped();
				$licenses[$licenseKey] = 'thirdparty-custom';
			}

			$preferences['upwiz_deflicense'] = [
				'type' => 'radio',
				'label-message' => 'mwe-upwiz-prefs-def-license',
				'section' => 'uploads/upwiz-licensing',
				'options' => $licenses
			];

			if ( $hasCustom ) {
				$preferences['upwiz_deflicense_custom'] = [
					'type' => 'text',
					'label-message' => 'mwe-upwiz-prefs-def-license-custom',
					'help-message' => 'mwe-upwiz-prefs-def-license-custom-help',
					'section' => 'uploads/upwiz-licensing',
				];
			}
		}

		// Setting for maximum number of simultaneous uploads (always lower than the server-side config)
		if ( $config[ 'maxSimultaneousConnections' ] > 1 ) {
			// Hack to make the key and value the same otherwise options are added wrongly.
			$range = range( 0, $config[ 'maxSimultaneousConnections' ] );
			$range[0] = 'default';

			$preferences['upwiz_maxsimultaneous'] = [
				'type' => 'select',
				'label-message' => 'mwe-upwiz-prefs-maxsimultaneous-upload',
				'section' => 'uploads/upwiz-experimental',
				'options' => $range
			];
		}

		// Store user dismissal of machine vision CTA on final step.
		$preferences['upwiz_mv_cta_dismissed'] = [
			'type' => 'api'
		];

		return true;
	}

	/**
	 * Add icon for Special:Preferences mobile layout
	 *
	 * @param array &$iconNames Array of icon names for their respective sections.
	 */
	public static function onPreferencesGetIcon( &$iconNames ) {
		$iconNames[ 'uploads' ] = 'upload';
	}

	/**
	 * Hook to blacklist flickr images by intercepting upload from url
	 * @param string $url
	 * @param bool &$allowed
	 * @return true
	 */
	public static function onIsUploadAllowedFromUrl( $url, &$allowed ) {
		if ( $allowed ) {
			$flickrBlacklist = new FlickrBlacklist(
				Config::getConfig(),
				RequestContext::getMain()
			);
			if ( $flickrBlacklist->isBlacklisted( $url ) ) {
				$allowed = false;
			}
		}
		return true;
	}

	/**
	 * Helper function to get the message for a license.
	 *
	 * @since 1.2
	 *
	 * @param string $licenseName
	 * @param array $licenseConfig
	 *
	 * @return string
	 */
	public static function getLicenseMessage( $licenseName, array $licenseConfig ) {
		if ( array_key_exists( 'url', $licenseConfig[$licenseName] ) ) {
			return wfMessage(
				$licenseConfig[$licenseName]['msg'],
				'',
				$licenseConfig[$licenseName]['url']
			)->parse();
		}

		return wfMessage( $licenseConfig[$licenseName]['msg'] )->escaped();
	}

	/**
	 * Lists tags used by UploadWizard (via ListDefinedTags,
	 * ListExplicitlyDefinedTags & ChangeTagsListActive hooks)
	 *
	 * @param array &$tags
	 * @return bool true
	 */
	public static function onListDefinedTags( &$tags ) {
		$tags[] = 'uploadwizard';
		$tags[] = 'uploadwizard-flickr';
		return true;
	}
}
